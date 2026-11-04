"""
Pydantic Schemas for FastAPI Gateway & Decision Support System
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CartItem(BaseModel):
    sku_id: str
    style_parent_id: str
    category: str
    size: str
    mrp: float


class CheckoutPayload(BaseModel):
    order_id: str
    customer_id: str
    payment_mode: str = Field(..., description="COD or PREPAID")
    pincode_tier: str = Field("Tier_2", description="Tier_1, Tier_2, or Tier_3")
    discount_pct: float = Field(0.15, description="Discount between 0.0 and 0.5")
    items: List[CartItem]


class WarehouseActionRequest(BaseModel):
    order_id: str
    action_taken: str = Field(..., description="QC_CHECK, SIZE_CONFIRMATION, PROTECTIVE_PACKAGING, or DISPATCH_AS_IS")
    operator_id: str = "STATION_PACKER_04"


class CopilotQuery(BaseModel):
    question: str
    context_order_id: Optional[str] = None
