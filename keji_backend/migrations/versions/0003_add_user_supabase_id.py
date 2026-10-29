"""Add user.supabase_id and make password_hash nullable

Revision ID: 0003_supabase_id
Revises: 0002_feedback
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003_supabase_id'
down_revision = '0002_feedback'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'user',
        sa.Column('supabase_id', sa.String(length=36), nullable=True)
    )
    op.create_index(
        op.f('ix_user_supabase_id'),
        'user',
        ['supabase_id'],
        unique=True
    )
    # New users are created via Supabase and no longer store a local password.
    op.alter_column(
        'user',
        'password_hash',
        existing_type=sa.String(length=256),
        nullable=True
    )


def downgrade():
    op.alter_column(
        'user',
        'password_hash',
        existing_type=sa.String(length=256),
        nullable=False
    )
    op.drop_index(op.f('ix_user_supabase_id'), table_name='user')
    op.drop_column('user', 'supabase_id')
