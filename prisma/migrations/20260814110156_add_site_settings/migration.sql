-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "heroImages" JSONB NOT NULL DEFAULT '[]',
    "freeShippingThreshold" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "standardShippingFee" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
