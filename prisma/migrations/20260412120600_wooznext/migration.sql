-- CreateIndex
CREATE INDEX "counters_agent_id_idx" ON "counters"("agent_id");

-- CreateIndex
CREATE INDEX "counters_service_id_idx" ON "counters"("service_id");

-- CreateIndex
CREATE INDEX "tickets_service_id_status_createdAt_idx" ON "tickets"("service_id", "status", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_called_by_id_idx" ON "tickets"("called_by_id");

-- CreateIndex
CREATE INDEX "tickets_completed_at_idx" ON "tickets"("completed_at");
