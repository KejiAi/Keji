"""Add feedback table

Revision ID: 0002_feedback
Revises: 0001_initial
Create Date: 2025-12-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_feedback'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    # Create feedback table
    op.create_table('feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on user_id for faster lookups
    op.create_index(op.f('ix_feedback_user_id'), 'feedback', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_feedback_user_id'), table_name='feedback')
    op.drop_table('feedback')
