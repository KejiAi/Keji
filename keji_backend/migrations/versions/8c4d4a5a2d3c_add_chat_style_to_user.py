"""add chat_style to user

Revision ID: 8c4d4a5a2d3c
Revises: 1f536042ef66
Create Date: 2025-11-02 23:58:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8c4d4a5a2d3c"
down_revision = "1f536042ef66"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column("chat_style", sa.String(length=50), nullable=True),
    )
    op.execute(
        "UPDATE \"user\" SET chat_style = 'pure_english' WHERE chat_style IS NULL"
    )
    op.alter_column("user", "chat_style", nullable=False, server_default="pure_english")


def downgrade():
    op.drop_column("user", "chat_style")


