-- AlterTable
ALTER TABLE "gap_items" ADD COLUMN     "effortHours" DOUBLE PRECISION,
ADD COLUMN     "fromTemplate" BOOLEAN NOT NULL DEFAULT false;

