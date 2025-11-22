"""Initial schema with all tables

Revision ID: 0001_initial
Revises: 
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create user table
    op.create_table('user',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('email', sa.String(length=150), nullable=False),
    sa.Column('password_hash', sa.String(length=256), nullable=False),
    sa.Column('is_verified', sa.Boolean(), nullable=True),
    sa.Column('chat_style', sa.String(length=50), nullable=False, server_default='pure_english'),
    sa.Column('verification_code', sa.String(length=6), nullable=True),
    sa.Column('verification_token', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    
    # Create conversation table
    op.create_table('conversation',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('memory_summary', sa.Text(), nullable=True),
    sa.Column('pruned_count', sa.Integer(), nullable=True, server_default='0'),
    sa.Column('last_summary_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    # Create message table
    op.create_table('message',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('conversation_id', sa.Integer(), nullable=False),
    sa.Column('sender', sa.String(length=10), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('timestamp', sa.DateTime(), nullable=True),
    sa.Column('message_group_id', sa.String(length=36), nullable=True),
    sa.Column('chunk_index', sa.Integer(), nullable=True),
    sa.Column('total_chunks', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversation.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    # Create message_attachment table
    op.create_table('message_attachment',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('message_id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('url', sa.String(length=1024), nullable=False),
    sa.Column('content_type', sa.String(length=120), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['message_id'], ['message.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on message_attachment.message_id
    op.create_index(op.f('ix_message_attachment_message_id'), 'message_attachment', ['message_id'], unique=False)


def downgrade():
    # Drop tables in reverse order
    op.drop_index(op.f('ix_message_attachment_message_id'), table_name='message_attachment')
    op.drop_table('message_attachment')
    op.drop_table('message')
    op.drop_table('conversation')
    op.drop_table('user')

