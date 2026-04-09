"""add_indexes_hot_columns

Revision ID: 49b21f9d6e64
Revises: 4cb31083d119
Create Date: 2026-04-09 11:17:10.863634

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '49b21f9d6e64'
down_revision: Union[str, None] = '4cb31083d119'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use if_not_exists=True so this migration is safe to re-run on databases
    # whose physical schema is ahead of the alembic_version table (e.g. a DB
    # whose indexes were already created by create_all before alembic managed them).
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False, if_not_exists=True)
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False, if_not_exists=True)
    op.create_index('ix_execution_plans_patient_id', 'execution_plans', ['patient_id'], unique=False, if_not_exists=True)
    op.create_index('ix_execution_plans_status', 'execution_plans', ['status'], unique=False, if_not_exists=True)
    op.create_index('ix_test_sessions_execution_plan_id', 'test_sessions', ['execution_plan_id'], unique=False, if_not_exists=True)
    op.create_index('ix_test_sessions_patient_id', 'test_sessions', ['patient_id'], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.drop_index('ix_test_sessions_patient_id', table_name='test_sessions')
    op.drop_index('ix_test_sessions_execution_plan_id', table_name='test_sessions')
    op.drop_index('ix_execution_plans_status', table_name='execution_plans')
    op.drop_index('ix_execution_plans_patient_id', table_name='execution_plans')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
