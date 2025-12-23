-- CreateTable
CREATE TABLE "week_day_capacities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekPlanId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "plannedPatients" INTEGER,
    "agreedMaxPatients" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "week_day_capacities_weekPlanId_fkey" FOREIGN KEY ("weekPlanId") REFERENCES "week_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "week_day_capacities_date_idx" ON "week_day_capacities"("date");

-- CreateIndex
CREATE UNIQUE INDEX "week_day_capacities_weekPlanId_date_key" ON "week_day_capacities"("weekPlanId", "date");
