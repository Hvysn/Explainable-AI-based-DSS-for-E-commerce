# Standard Operating Procedure (SOP): Bracket Shopping Detection & Pre-Dispatch Size Verification

**Document ID:** SOP-WMS-BRACKET-2026-V2  
**Applicability:** E-Commerce Ingress Pipeline · Customer Outreach Ops · Packing Supervisors  
**Owner:** Reverse Logistics Loss Prevention & Operations Engineering

---

## 1. Context and Problem Definition
**Bracket Shopping** occurs when an e-commerce customer purchases two or more adjacent sizes of an identical garment style (e.g., Size M and Size L of the same Kurti, Shirt, or Jeans) with the premeditated intent of trying both garments at home and returning the non-fitting unit.
- **Industry Incidence:** Occurs in approximately 14% of multi-item fashion orders.
- **Return Probability:** Greater than **88%** for the secondary unit.
- **Financial Risk:** Multiplied by 2.5× when combined with Cash-on-Delivery (COD) in Tier-2/Tier-3 delivery locations.

## 2. Real-Time Detection Heuristic
The cart anomaly engine flags an order as an active bracket transaction when:
1. Two or more cart items share the same `style_parent_id`.
2. The items have differing size attributes (e.g., `M` and `L`, or `30` and `32`).
3. The items belong to apparel categories prone to fit ambiguity (`Women Western`, `Women Ethnic`, `Men Formal`).

## 3. Prescribed Operational Intervention: Automated WhatsApp Verification
When the cost engine confirms $\mathbb{E}[\text{Savings}] > 0$, the system halts packing and initiates the **Automated Size-Verification Prompt** ($C = ₹5.00$):

### Automated Customer Message Template:
> *"Hi [Customer_Name], thank you for ordering the [Garment_Name]! We noticed you selected both Size [Size_1] and Size [Size_2]. To ensure you receive the perfect fit on your first delivery, our sizing recommendation engine suggests [Recommended_Size] based on past buyer measurements (Chest: 38", Shoulder: 15").*  
> *👉 Reply **1** to dispatch Size [Size_1] only (Save ₹[Price]).*  
> *👉 Reply **2** to dispatch Size [Size_2] only.*  
> *👉 Reply **3** to keep both sizes."*

## 4. Packing Floor SLA & Branching Rules
- **Window:** The order is held in the `HOLD_SIZE_CONFIRMATION` queue for a maximum of 45 minutes during warehouse staging.
- **Response Received (Branch A - Single Size Confirmed):**
  - Packing station automatically cancels the redundant SKU.
  - Refund or revised COD invoice is updated in real time.
  - Single verified garment is packed and dispatched.
  - **Net Savings Realized:** ₹195.00 to ₹395.00.
- **No Response within 45 Minutes (Branch B - Default Release):**
  - The parcel is released to the packing line with a high-visibility return label to expedite hub reverse triage.

## 5. Escalation & Supervisor Discretion
If the customer account displays a historical return rate exceeding **60%** and $\ge 2$ past RTO incidents, the supervisor is authorized to place a 30-second telephone verification call from the packing station terminal before authorizing COD truck loading.
