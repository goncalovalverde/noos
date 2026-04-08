import uuid
import json
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class ExecutionPlan(Base):
    __tablename__ = "execution_plans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    protocol_id = Column(String, ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True)
    test_customizations = Column(Text, nullable=True)   # JSON array
    status = Column(String, default="draft")             # draft | active | completed | abandoned
    mode = Column(String, default="live")                # live | paper
    is_saved_variant = Column(Boolean, default=False)
    variant_name = Column(String, nullable=True)
    performed_at = Column(DateTime, nullable=True)  # when evaluation was actually done (paper: may differ from created_at)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="execution_plans")
    protocol = relationship("Protocol", back_populates="execution_plans")

    def _get_customizations(self) -> List[Dict[str, Any]]:
        return json.loads(self.test_customizations) if self.test_customizations else []

    def _set_customizations(self, data: List[Dict[str, Any]]):
        self.test_customizations = json.dumps(data)

    def get_tests_to_execute(self) -> List[Dict[str, Any]]:
        return sorted([t for t in self._get_customizations() if not t.get("skip")], key=lambda x: x.get("order", 99))

    def get_tests_to_repeat(self) -> List[Dict[str, Any]]:
        return [t for t in self._get_customizations() if t.get("repeat_later")]

    def get_added_tests(self) -> List[Dict[str, Any]]:
        return [t for t in self._get_customizations() if t.get("added")]

    def add_test(self, test_type: str, order: int = None):
        data = self._get_customizations()
        if order is None:
            order = max((t.get("order", 0) for t in data), default=0) + 1
        data.append({"test_type": test_type, "order": order, "skip": False, "added": True, "repeat_later": False, "notes": ""})
        self._set_customizations(data)

    def remove_test(self, test_type: str):
        data = self._get_customizations()
        for t in data:
            if t["test_type"] == test_type:
                t["skip"] = True
        self._set_customizations(data)

    def update_test(self, test_type: str, **kwargs):
        data = self._get_customizations()
        for t in data:
            if t["test_type"] == test_type:
                t.update(kwargs)
        self._set_customizations(data)

    def reorder_test(self, test_type: str, new_order: int):
        data = self._get_customizations()
        for t in data:
            if t["test_type"] == test_type:
                t["order"] = new_order
        self._set_customizations(sorted(data, key=lambda x: x.get("order", 99)))
