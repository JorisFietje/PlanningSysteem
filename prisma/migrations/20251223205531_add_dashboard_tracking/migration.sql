-- CreateTable
CREATE TABLE "dashboard_departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dashboard_tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "referralsJson" TEXT NOT NULL DEFAULT '[]',
    "wastedMedsJson" TEXT NOT NULL DEFAULT '[]',
    "noShows" INTEGER NOT NULL DEFAULT 0,
    "lateCancellations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_departments_name_key" ON "dashboard_departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_tracking_date_key" ON "dashboard_tracking"("date");

-- CreateIndex
CREATE INDEX "dashboard_tracking_date_idx" ON "dashboard_tracking"("date");
