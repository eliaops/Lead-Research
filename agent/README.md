# BidToGo Local Agents

Local agents run on your machine to interact with procurement platforms that require browser authentication. They sync data with the BidToGo cloud.

## Setup

```bash
cd agent
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env
# Edit .env with your values
```

## Configuration (.env)

| Variable | Description |
|---|---|
| `CLOUD_API_URL` | Your BidToGo instance URL (e.g. `https://bidtogo.ca`) |
| `AGENT_API_KEY` | API key for agent authentication (matches server's `AGENT_API_KEY`) |
| `MERX_EMAIL` | MERX account email (for merx_agent.py) |
| `MERX_PASSWORD` | MERX account password |
| `BT_EMAIL` | Bids & Tenders subscription email (for bt_agent.py) |
| `BT_PASSWORD` | Bids & Tenders password |

---

## MERX Agent (merx_agent.py)

Crawls MERX from your local machine (MERX blocks datacenter IPs) and uploads opportunities to BidToGo.

```bash
python merx_agent.py --status    # check connectivity
python merx_agent.py             # full crawl + upload
python merx_agent.py --dry-run   # crawl without uploading
```

---

## Bids & Tenders Agent (bt_agent.py)

Downloads bid documents for high-relevance opportunities found by BidToGo's cloud crawler, extracts PDFs from ZIPs, uploads to cloud for automatic AI deep analysis.

**Workflow:**
1. Queries BidToGo cloud for high-relevance B&T opportunities without documents
2. Logs into your bidsandtenders.ca paid subscription
3. Navigates to each opportunity's detail page
4. Downloads the bid documents ZIP
5. Extracts PDFs/DOCX from the ZIP
6. Uploads documents to BidToGo cloud API
7. Cloud automatically triggers AI deep analysis + Qingyan push
8. You receive the final analysis report

```bash
python bt_agent.py --status      # check connectivity
python bt_agent.py --dry-run     # list pending, don't download
python bt_agent.py               # full run: download + upload + analyze
python bt_agent.py --headed      # run with visible browser (for debugging)
```

---

## Scheduling

Run agents on a schedule using cron:

```bash
# MERX: every 6 hours
0 */6 * * * cd /path/to/agent && python merx_agent.py >> merx_agent.log 2>&1

# B&T documents: daily at 10am
0 10 * * * cd /path/to/agent && python bt_agent.py >> bt_agent.log 2>&1
```
