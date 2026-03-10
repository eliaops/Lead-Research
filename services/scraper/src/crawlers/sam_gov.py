"""SAM.gov crawler — US federal contract opportunities.

Uses the SAM.gov public-facing search API to fetch solicitations, presolicitations,
and combined synopsis/solicitation notices. After retrieving listing-level data,
fetches the detail description text from the SAM.gov notice description endpoint
and extracts resource links (documents/attachments).

Pagination: limit=100 per page, offset-based.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone, timedelta
from typing import Any
from urllib.parse import urlencode

from src.crawlers.base import BaseCrawler
from src.models.opportunity import OpportunityCreate, OpportunityStatus

_API_BASE = "https://sam.gov/api/prod/opportunities/v2/search"
_UI_BASE = "https://sam.gov/opp"

_NOTICE_TYPES = "o,p,k,r,s"

# NAICS codes relevant to our industry vertical
_INDUSTRY_NAICS = [
    "337920",  # Blind and Shade Manufacturing
    "314120",  # Curtain and Linen Mills
    "314910",  # Textile Bag and Canvas Mills
    "314999",  # All Other Miscellaneous Textile Product Mills
    "337127",  # Institutional Furniture Manufacturing
    "337211",  # Wood Office Furniture Manufacturing
    "337212",  # Custom Architectural Woodwork and Millwork Manufacturing
    "442210",  # Floor Covering Stores
    "423220",  # Home Furnishing Merchant Wholesalers
    "561720",  # Janitorial Services (linen/textile supply contracts)
    "812331",  # Linen Supply
    "236220",  # Commercial and Institutional Building Construction
    "238390",  # Other Building Finishing Contractors
    "238990",  # All Other Specialty Trade Contractors
]

_INDUSTRY_KEYWORDS = [
    "blinds", "curtains", "drapery", "window covering", "window treatment",
    "furnishing", "furniture", "textile", "fabric", "linen", "bedding",
    "carpet", "flooring", "renovation", "interior", "FF&E",
    "upholstery", "shade", "cubicle curtain", "privacy curtain",
    "roller shade", "blackout", "motorized shade", "solar shade",
    "window shade", "hospital curtain", "privacy divider",
]

_STATE_MAP = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}

_KEYWORD_RE = re.compile(
    "|".join(re.escape(kw) for kw in _INDUSTRY_KEYWORDS),
    re.IGNORECASE,
)


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(date_str[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


class SamGovCrawler(BaseCrawler):
    """Crawl SAM.gov for US federal procurement opportunities."""

    def crawl(self) -> list[OpportunityCreate]:
        cfg = self.source_config.crawl_config
        max_pages = cfg.get("max_pages", 10)
        per_page = cfg.get("per_page", 100)
        days_back = cfg.get("days_back", 30)
        pre_filter = cfg.get("pre_filter_keywords", True)
        naics_codes = cfg.get("naics_codes", _INDUSTRY_NAICS)

        self._http.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        })

        now = datetime.now(timezone.utc)
        date_from = (now - timedelta(days=days_back)).strftime("%m/%d/%Y")
        date_to = now.strftime("%m/%d/%Y")

        seen_ids: set[str] = set()
        all_opps: list[OpportunityCreate] = []

        # Strategy 1: NAICS-targeted searches for high-relevance hits
        for naics in naics_codes:
            opps = self._search_api(
                extra_params={"ncode": naics},
                date_from=date_from, date_to=date_to,
                max_pages=min(max_pages, 3), per_page=per_page,
                pre_filter=False, seen_ids=seen_ids,
            )
            all_opps.extend(opps)
            self.logger.info("NAICS %s: %d opportunities", naics, len(opps))
            time.sleep(1)

        # Strategy 2: Keyword searches for additional coverage
        keyword_groups = [
            "blinds curtains drapery",
            "window covering window treatment",
            "furnishing textile fabric linen",
            "FF&E interior renovation",
        ]
        for kw_group in keyword_groups:
            opps = self._search_api(
                extra_params={"q": kw_group},
                date_from=date_from, date_to=date_to,
                max_pages=min(max_pages, 3), per_page=per_page,
                pre_filter=pre_filter, seen_ids=seen_ids,
            )
            all_opps.extend(opps)
            self.logger.info("Keyword '%s': %d opportunities", kw_group[:30], len(opps))
            time.sleep(1)

        # Strategy 3: Broad recent postings with pre-filtering
        broad_opps = self._search_api(
            extra_params={},
            date_from=date_from, date_to=date_to,
            max_pages=max_pages, per_page=per_page,
            pre_filter=True, seen_ids=seen_ids,
        )
        all_opps.extend(broad_opps)
        self.logger.info("Broad scan: %d opportunities (pre-filtered)", len(broad_opps))

        self.logger.info("SAM.gov crawl complete: %d total unique opportunities", len(all_opps))
        return all_opps

    def _search_api(
        self,
        extra_params: dict,
        date_from: str,
        date_to: str,
        max_pages: int,
        per_page: int,
        pre_filter: bool,
        seen_ids: set[str],
    ) -> list[OpportunityCreate]:
        """Run a single search strategy against the SAM.gov API."""
        results: list[OpportunityCreate] = []
        total_fetched = 0

        for page_offset in range(0, max_pages * per_page, per_page):
            params = {
                "limit": per_page,
                "offset": page_offset,
                "api_key": "",
                "postedFrom": date_from,
                "postedTo": date_to,
                "ptype": _NOTICE_TYPES,
                **extra_params,
            }
            url = f"{_API_BASE}?{urlencode(params)}"

            try:
                response = self._http.get(url, timeout=30)
                response.raise_for_status()
                data = response.json()
            except Exception as exc:
                self.logger.warning("SAM.gov API error at offset %d: %s", page_offset, exc)
                break

            records = data.get("opportunitiesData", [])
            if not records:
                break

            total_records = data.get("totalRecords", 0)
            total_fetched += len(records)

            for record in records:
                notice_id = record.get("noticeId", "")
                if notice_id in seen_ids:
                    continue
                opp = self._parse_record(record, pre_filter)
                if opp:
                    seen_ids.add(notice_id)
                    results.append(opp)

            if total_fetched >= total_records:
                break
            time.sleep(2)

        return results

    def _fetch_description(self, description_url: str) -> str:
        """Fetch the actual description text from the SAM.gov notice description URL."""
        if not description_url or not description_url.startswith("http"):
            return ""
        try:
            resp = self._http.get(description_url, timeout=15)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "json" in content_type:
                data = resp.json()
                # The API returns {"description": "...actual text..."} or
                # it may return the text nested differently
                if isinstance(data, dict):
                    return (
                        data.get("description", "")
                        or data.get("content", "")
                        or data.get("body", "")
                        or str(data)
                    )
                return str(data)
            text = resp.text.strip()
            # Strip HTML tags if present
            clean = re.sub(r"<[^>]+>", " ", text)
            clean = re.sub(r"\s+", " ", clean).strip()
            return clean[:10000]
        except Exception as exc:
            self.logger.debug("Failed to fetch description from %s: %s", description_url[:80], exc)
            return ""

    def _extract_resource_links(self, record: dict) -> list[dict[str, Any]]:
        """Extract document/attachment metadata from the API record."""
        docs: list[dict[str, Any]] = []
        for link in record.get("resourceLinks", []):
            url = link if isinstance(link, str) else link.get("url", "")
            if not url:
                continue
            title = link.get("title", "") if isinstance(link, dict) else ""
            if not title:
                # Derive title from URL filename
                title = url.rstrip("/").split("/")[-1].split("?")[0]
            file_type = ""
            lower_url = url.lower()
            for ext in (".pdf", ".docx", ".doc", ".xlsx", ".xls", ".zip", ".csv"):
                if ext in lower_url:
                    file_type = ext.lstrip(".")
                    break
            docs.append({
                "title": title[:250],
                "url": url,
                "file_type": file_type or "link",
            })

        # Also check for 'additionalInfoLink' or 'links' arrays
        for link in record.get("links", []):
            url = link.get("href", "") if isinstance(link, dict) else str(link)
            if url and url not in [d["url"] for d in docs]:
                docs.append({
                    "title": (link.get("rel", "") if isinstance(link, dict) else "")[:250] or "Related Link",
                    "url": url,
                    "file_type": "link",
                })

        return docs

    def _parse_record(self, record: dict, pre_filter: bool) -> OpportunityCreate | None:
        title = record.get("title", "").strip()[:250]
        if not title:
            return None

        notice_id = record.get("noticeId", "")
        sol_number = record.get("solicitationNumber", "")

        org_path = record.get("fullParentPathName", "")
        org_name = org_path.split(".")[-1].strip()[:200] if org_path else None

        posted = _parse_date(record.get("postedDate"))
        closing = _parse_date(record.get("responseDeadLine"))

        office_addr = record.get("officeAddress") or {}
        state_code = office_addr.get("state", "")
        city = office_addr.get("city", "")
        zip_code = office_addr.get("zipcode", "")
        region = state_code if state_code else None

        notice_type = record.get("type", "")
        naics = record.get("naicsCode", "")
        classification = record.get("classificationCode", "")

        # Pre-filter: skip obvious non-matches to reduce DB volume
        if pre_filter:
            combined = f"{title} {org_path} {notice_type} {naics}".lower()
            if not _KEYWORD_RE.search(combined):
                broad_terms = ["construct", "renovat", "building", "facilit", "interior",
                               "maintenance", "repair", "install", "supply", "deliver"]
                if not any(t in combined for t in broad_terms):
                    return None

        ui_link = record.get("uiLink", "")
        if not ui_link and notice_id:
            ui_link = f"{_UI_BASE}/{notice_id}/view"

        contacts = record.get("pointOfContact", [])
        contact_name = None
        contact_email = None
        contact_phone = None
        if contacts:
            primary = contacts[0]
            contact_name = primary.get("fullName")
            contact_email = primary.get("email")
            contact_phone = primary.get("phone")

        description_url = record.get("description", "")

        # Fetch real description text instead of storing the URL
        desc_text = ""
        if description_url and description_url.startswith("http"):
            desc_text = self._fetch_description(description_url)
            time.sleep(0.3)

        # Build a rich summary line
        summary_parts = []
        if naics:
            summary_parts.append(f"NAICS: {naics}")
        if classification:
            summary_parts.append(f"Classification: {classification}")
        if notice_type:
            summary_parts.append(f"Type: {notice_type}")
        if office_addr.get("city"):
            addr_str = f"Office: {office_addr.get('city', '')}, {state_code}"
            if zip_code:
                addr_str += f" {zip_code}"
            summary_parts.append(addr_str)

        # Extract document links
        resource_links = self._extract_resource_links(record)

        return OpportunityCreate(
            source_id=self.source_config.id,
            external_id=notice_id or sol_number,
            title=title,
            description_summary=". ".join(summary_parts)[:500] if summary_parts else None,
            description_full=desc_text[:15000] if desc_text else None,
            status=OpportunityStatus.OPEN,
            country="US",
            region=region,
            city=city,
            location_raw=(f"{city}, {_STATE_MAP.get(state_code, state_code)}" if city else state_code)[:200],
            posted_date=posted.date() if posted else None,
            closing_date=closing,
            project_type=notice_type[:250] if notice_type else None,
            category=(f"NAICS {naics}" if naics else "Federal Procurement")[:250],
            solicitation_number=(sol_number or notice_id)[:250],
            currency="USD",
            contact_name=contact_name,
            contact_email=contact_email,
            contact_phone=contact_phone,
            source_url=ui_link,
            has_documents=len(resource_links) > 0,
            organization_name=org_name,
            raw_data={
                "parser_version": "samgov_v2",
                "notice_id": notice_id,
                "naics_code": naics,
                "classification_code": classification,
                "notice_type": notice_type,
                "org_path": org_path,
                "description_url": description_url,
                "office_address": office_addr,
                "resource_links": resource_links,
                "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
            },
            fingerprint="",
        )
