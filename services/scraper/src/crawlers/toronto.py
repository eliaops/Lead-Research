"""Toronto Bids crawler — City of Toronto Open Data JSON API.

The City of Toronto publishes all open solicitations via CKAN Open Data:
  https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/tobids-all-open-solicitations

The JSON endpoint returns ~900 records (all historical + current), refreshed daily.
Each record has: Document Number, RFx Type, NOIP Type, Issue Date, Submission Deadline,
High Level Category, Description, Division, Buyer Name/Email/Phone, Wards.

The crawler fetches the full JSON, filters to recent open items (with future deadlines),
and converts to OpportunityCreate objects.
"""

from __future__ import annotations

from datetime import datetime, timezone

from src.crawlers.base import BaseCrawler
from src.models.opportunity import OpportunityCreate, OpportunityStatus

_JSON_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "434c2d91-1736-432a-a69f-d5b3890f239f/resource/"
    "4be43731-78b7-4147-99a7-43b40b4f7257/download/all-solicitations.json"
)

_ARIBA_BASE = "https://toronto.sourcing.ariba.com"


class TorontoCrawler(BaseCrawler):
    """Crawl City of Toronto solicitations via the CKAN Open Data JSON feed."""

    def crawl(self) -> list[OpportunityCreate]:
        self.logger.info("Fetching Toronto Open Data JSON...")
        data = self._fetch_json()
        if data is None:
            return []

        now = datetime.now(timezone.utc).date()
        results: list[OpportunityCreate] = []
        skipped_old = 0
        skipped_no_id = 0

        for item in data:
            doc_num = item.get("Document Number")
            if not doc_num:
                skipped_no_id += 1
                continue

            deadline_str = item.get("Submission Deadline") or ""
            if deadline_str:
                try:
                    deadline = datetime.strptime(deadline_str, "%Y-%m-%d").date()
                    if deadline < now:
                        skipped_old += 1
                        continue
                except ValueError:
                    pass

            opp = self._parse_item(item)
            if opp:
                results.append(opp)

        self.logger.info(
            "Toronto crawl complete: %d opportunities (skipped %d expired, %d no-id, %d total in feed)",
            len(results), skipped_old, skipped_no_id, len(data),
        )
        return results

    def _fetch_json(self) -> list[dict] | None:
        self.rate_limit()
        try:
            resp = self._http.get(_JSON_URL, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list):
                self.logger.warning("Toronto JSON is not a list: %s", type(data))
                return None
            self.logger.info("Fetched %d records from Toronto Open Data", len(data))
            return data
        except Exception as exc:
            self.logger.error("Failed to fetch Toronto data: %s", exc)
            return None

    def _parse_item(self, item: dict) -> OpportunityCreate | None:
        doc_num = str(item.get("Document Number", "")).strip()
        if not doc_num:
            return None

        description = (item.get("Solicitation Document Description") or "").strip()
        rfx_type = item.get("RFx (Solicitation) Type") or ""
        title = f"[{rfx_type}] {doc_num}" if rfx_type else doc_num
        if description:
            title_preview = description[:100].rstrip()
            if len(description) > 100:
                title_preview += "..."
            title = f"[{rfx_type}] {title_preview}" if rfx_type else title_preview

        issue_date = self._parse_date(item.get("Issue Date"))
        deadline = self._parse_date(item.get("Submission Deadline"))
        closing_dt = datetime.combine(deadline, datetime.min.time()).replace(
            tzinfo=timezone.utc
        ) if deadline else None

        category = item.get("High Level Category") or "Procurement"
        division = item.get("Division") or ""
        buyer_name = item.get("Buyer Name") or None
        buyer_email = item.get("Buyer Email") or None
        buyer_phone = item.get("Buyer Phone Number") or None

        source_url = f"{_ARIBA_BASE}/ad/search?q={doc_num}"

        return OpportunityCreate(
            source_id=self.source_config.id,
            external_id=doc_num,
            title=title,
            description_summary=description[:500] if description else None,
            description_full=description or None,
            status=OpportunityStatus.OPEN,
            country="CA",
            region="ON",
            city="Toronto",
            location_raw="Toronto, ON, Canada",
            posted_date=issue_date,
            closing_date=closing_dt,
            category=category,
            solicitation_number=doc_num,
            currency="CAD",
            contact_name=buyer_name,
            contact_email=buyer_email,
            source_url=source_url,
            has_documents=False,
            organization_name=f"City of Toronto — {division}" if division else "City of Toronto",
            raw_data={
                "parser_version": "toronto_v1",
                "rfx_type": rfx_type,
                "noip_type": item.get("NOIP (Notice of Intended Procurement) Type"),
                "division": division,
                "buyer_phone": buyer_phone,
                "wards": item.get("Wards"),
                "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
            },
            fingerprint="",
        )

    @staticmethod
    def _parse_date(raw: str | None):
        if not raw:
            return None
        try:
            return datetime.strptime(raw.strip(), "%Y-%m-%d").date()
        except ValueError:
            return None
