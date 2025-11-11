-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "medicationType" TEXT NOT NULL,
    "treatmentNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "staff" TEXT,
    "type" TEXT,
    "actualDuration" INTEGER,
    "patientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "actions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "week_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStartDate" TEXT NOT NULL,
    "weekEndDate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "generatedPatients" TEXT
);

-- CreateTable
CREATE TABLE "week_staff_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekPlanId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "staffNames" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "week_staff_schedules_weekPlanId_fkey" FOREIGN KEY ("weekPlanId") REFERENCES "week_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "week_treatments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekPlanId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "treatmentNumber" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "week_treatments_weekPlanId_fkey" FOREIGN KEY ("weekPlanId") REFERENCES "week_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "maxPatients" INTEGER NOT NULL,
    "maxWorkTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "patients_scheduledDate_idx" ON "patients"("scheduledDate");

-- CreateIndex
CREATE INDEX "week_plans_weekStartDate_idx" ON "week_plans"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "week_plans_weekStartDate_key" ON "week_plans"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "week_staff_schedules_weekPlanId_dayOfWeek_key" ON "week_staff_schedules"("weekPlanId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "staff_name_key" ON "staff"("name");
