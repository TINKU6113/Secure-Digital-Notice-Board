-- Migration: 002_create_notices_table.sql
-- Description: Creates the notices table with lifecycle status and validation constraints

CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'CYS', 'ECE', 'EEE', 'ME', 'General')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('Academic', 'Examination', 'Placement', 'Event', 'Workshop', 'Holiday', 'Emergency', 'General')),
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Important', 'Urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    scheduled_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notice_dates CHECK (expires_at IS NULL OR scheduled_at IS NULL OR expires_at > scheduled_at)
);

-- Indexes for performance and filtering
CREATE INDEX IF NOT EXISTS idx_notices_status ON notices(status);
CREATE INDEX IF NOT EXISTS idx_notices_dept ON notices(department);
CREATE INDEX IF NOT EXISTS idx_notices_category ON notices(category);
CREATE INDEX IF NOT EXISTS idx_notices_priority ON notices(priority);
CREATE INDEX IF NOT EXISTS idx_notices_author ON notices(author_id);
CREATE INDEX IF NOT EXISTS idx_notices_scheduled ON notices(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notices_expires ON notices(expires_at);
CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at DESC);
