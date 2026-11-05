# Explainable AI-Based Reverse Logistics Decision Support System for E-Commerce

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![XGBoost](https://img.shields.io/badge/XGBoost-Classifier-1182C5?style=flat)](https://xgboost.readthedocs.io/)
[![TreeSHAP](https://img.shields.io/badge/XAI-TreeSHAP-ff69b4?style=flat)](https://shap.readthedocs.io/)
[![AI Agent](https://img.shields.io/badge/AI_Agent-ReAct_Tool_Calling_%2B_RAG-orange?style=flat)](#-enterprise-forward-deployed-ai-agent--rag)
[![Research Paper](https://img.shields.io/badge/Research_Paper-IEEE_Format-blueviolet?style=flat)](./docs/Conference_Research_Paper_Manuscript.md)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)

**Final Year Capstone Project — CS23821 Project Work**  
**Department of Computer Science and Engineering**  
**Rajalakshmi Institute of Technology (RIT)**

---

## 👥 Project Team & Mentorship
* **Project Guide:** Rubiya G (Assistant Professor / CSE)
* **Team Members:**
  * **Hemavarshini Y** (2117230020069)
  * **Jeyashree Narayanan A** (2117230020082)
  * **Jayanth S** (2117230025001)

---

## 📄 Research Publication & Conference Manuscript
* **Paper Title:** *Explainable AI-Driven Decision Support System for Reverse Logistics Optimization in E-Commerce*
* **Target Venue:** IEEE / Springer International Conference (Computer Science & Intelligent Logistics)
* **Full Text Manuscript:** [Read IEEE Format Manuscript (docs/Conference_Research_Paper_Manuscript.md)](./docs/Conference_Research_Paper_Manuscript.md)
* **Key Innovations:** Asynchronous decoupled ingress (<50ms), offline DistilBERT review mining, TreeSHAP exact game-theoretic attributions, and unit economics cost-loss mitigation engine (28.4% net savings).

---

## 1. Problem Statement & Financial Context
* **Severe Financial Drain:** Indian online retail platforms lose over **₹50,000 crore annually** to reverse logistics, with apparel return rates exceeding **30%**.
* **High Unit Restocking Overhead:** E-commerce companies expend roughly **₹400 per returned apparel item** purely across reverse freight, quality inspection, re-bagging, and warehouse restocking labor.
* **Customer Behavioral Patterns:** Shoppers frequently engage in **"bracket shopping"**—ordering multiple adjacent sizes of the exact same clothing item with the pre-meditated intention of keeping one and returning the rest.
* **Operational Blind Spots:** Warehouse dispatch teams operate on static packing slips with zero visibility into return risk or product defect history prior to dispatch.

---

## 2. Proposed Architecture & System Workflow

```
[Customer Checkout] ──► [FastAPI Gateway (<50ms)] ──► [Redis Buffer Queue]
                                                              │
[PostgreSQL JSONB Defect Vectors] ─────────────────────► [Background Worker]
(Offline DistilBERT Review Mining)                            │
                                                              ▼
                                                   [XGBoost Risk Classifier]
                                                              │
                                                              ▼
                                                   [TreeSHAP Local Explainer]
                                                              │
                                                              ▼
                                                   [Cost-Loss Matrix Engine]
                                                              │
                                                              ▼
                                              [Warehouse Supervisor Dashboard]
                                              (Targeted QC / WhatsApp Size Prompts)
```

---

## 3. Mathematical Optimization Logic

The system shifts AI from passive prediction to **prescriptive unit economics optimization**:

### 1. Baseline Expected Loss
$$\text{Expected Loss} = P_{\text{return}} \times ₹400$$

### 2. Expected Net Operational Savings
$$\text{Expected Net Savings} = \Big(\Delta P_{\text{return}} \times ₹400\Big) - C_{\text{intervention}}$$

Where:
* $₹400$ is the baseline sunk cost of reverse shipping, inspection, and restocking.
* $\Delta P_{\text{return}}$ is the risk reduction factor achieved by the prescribed intervention.
* $C_{\text{intervention}}$ is the cost of the operational action:
  * **Automated WhatsApp Size Verification:** $C = ₹5.00$
  * **Targeted Pre-Shipment QC Inspection:** $C = ₹35.00$
  * **Reusable Protective Sleeve Deployment:** $C = ₹20.00$

---

## 🤖 Enterprise Forward Deployed AI Agent & Domain RAG

For enterprise fulfillment centers, the system embeds an **Autonomous Operations Agent** operating on a **ReAct (Reasoning + Acting) loop** with executable tool calling and Domain RAG:

```
[Supervisor Natural Language Query]
                 │
                 ▼
[Autonomous Warehouse AI Agent (ReAct Loop)]
   ├── Step 1: Thought ──► Tool Call: tool_get_order_xai_diagnostics (XGBoost + TreeSHAP)
   ├── Step 2: Thought ──► Tool Call: tool_query_warehouse_sop (Domain Vector RAG)
   ├── Step 3: Thought ──► Tool Call: tool_calculate_intervention_roi (Unit Economics)
   └── Step 4: Final Grounded Recommendation with SOP Citations & 1-Click Action
```

### 1. Domain RAG Knowledge Base (`data/knowledge_base/`)
* **`warehouse_qc_sop.md`**: Apparel defect tolerance checklists, 4-point physical QC protocols, and defect disposition codes (`BIN_VRB_04`).
* **`bracket_shopping_sop.md`**: Real-time multi-size cart detection rules and automated WhatsApp size-verification outreach scripts.
* **`carrier_logistics_sop.md`**: 3PL carrier (Blue Dart, Delhivery, Shadowfax) transit damage rules and ₹20 protective sleeve guidelines.

### 2. Autonomous Executable Tools (`src/agent/`)
* **`tool_get_order_xai_diagnostics`**: Retrieves live $P_{\text{return}}$ and local TreeSHAP root-cause feature attributions.
* **`tool_query_warehouse_sop`**: Semantic vector search retrieving grounded clauses from warehouse operating manuals.
* **`tool_calculate_intervention_roi`**: Computes baseline expected financial loss and net savings ROI across mitigation actions.
* **`tool_execute_warehouse_action`**: Dispatches physical QC tickets or automated customer WhatsApp verification prompts.

---

## 4. Security & Authentication

Authentication is enforced server-side. The Express gateway issues short-lived
JWTs, FastAPI verifies them, and both dashboards authenticate against the gateway
(no plaintext passwords, PINs or invite codes live in the browser bundles).

**Read [`docs/SECURITY.md`](./docs/SECURITY.md) before deploying.** In short:

```bash
cp .env.example .env
openssl rand -hex 32   # paste into JWT_SECRET
openssl rand -hex 32   # paste into INGEST_API_KEY
# then set SEED_ADMIN_*, TEAM_INVITE_CODE and CREATOR_MASTER_PIN
```

The first Creator account is seeded from `SEED_ADMIN_*` only when the user store
is empty — change its password immediately after the first login.

---

## 5. Quick Start & Execution Guide

### Option A: Direct Local Execution (No Docker needed)
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Hvysn/Explainable-AI-based-DSS-for-E-commerce.git
   cd Explainable-AI-based-DSS-for-E-commerce
   ```

2. **Configure secrets:**
   ```bash
   cp .env.example .env
   # edit .env: JWT_SECRET, INGEST_API_KEY, SEED_ADMIN_*, TEAM_INVITE_CODE, CREATOR_MASTER_PIN
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

4. **Generate Dataset & Train Models:**
   ```bash
   python data/generate_dataset.py
   python src/nlp/aspect_miner.py
   python src/ml/train_xgboost.py
   ```

5. **Start the Authentication Gateway:**
   ```bash
   cd server && npm start        # http://localhost:5000
   ```

6. **Launch the FastAPI Server** (separate terminal):
   ```bash
   uvicorn src.api.main:app --reload --port 8000
   ```

7. **Launch the Warehouse Supervisor Dashboard** (separate terminal):
   ```bash
   cd client && npm run dev      # http://localhost:3000 (proxies /api to :5000)
   ```
   The legacy `frontend/index.html` also works when served over HTTP and talks
   to the auth gateway at `http://localhost:5000`.

---

### Option B: 1-Click Docker Compose
Create `.env` first (see above), then launch all services (Auth Gateway + FastAPI
API + Redis Buffer + Nginx Dashboard UI) in isolated containers:
```bash
docker compose up --build
```
* **API Documentation:** `http://localhost:8000/docs`
* **Warehouse Dashboard:** `http://localhost:3000`
* **Auth Gateway:** `http://localhost:5000/api/health`

---

## 6. Live Demo Script for Evaluators
1. **Explain the Shift KPIs:** Point to the *Net Realized Savings* banner (showing positive ROI on intercepted orders).
2. **Inspect a High-Risk Parcel (e.g., `ORD_10001`):**
   * Show the **TreeSHAP waterfall/bar breakdown** demonstrating that *Bracket Shopping (+45%)* and *SKU Sizing Inconsistency (+26%)* are the primary drivers.
   * Highlight the **Financial Mitigation Matrix**: Baseline Loss ₹365 &rarr; WhatsApp Size Confirmation (₹5) &rarr; Net Projected Savings **₹195.20**.
3. **Trigger Real-Time Ingress (<50ms):**
   * Click the **"Simulate Ingress"** button to simulate a live customer checkout hitting the FastAPI gateway.
4. **Interact with the AI Copilot:**
   * Type: *"Why is ORD_10001 high risk?"* or *"How much money have we saved today?"* to demonstrate natural language operations.
