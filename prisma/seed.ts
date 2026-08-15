import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding aquarium store database...');

  const userPassword = await bcrypt.hash(process.env.SEED_USER_PASSWORD ?? 'User@12345', 10);
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'Admin@123', 10);

  await prisma.ticketReply.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.returnRequest.deleteMany();
  await prisma.statusLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.user.deleteMany();
  console.log('Cleared all existing data.');

  const admin = await prisma.user.create({
    data: {
      name: 'Aquarium Admin',
      email: process.env.ADMIN_EMAIL ?? 'admin@aquariumstore.com',
      phone: '+911234567890',
      password: adminPassword,
      role: Role.ADMIN,
      isVerified: true,
    },
  });
  console.log(`Admin created: ${admin.email}`);

  const user = await prisma.user.create({
    data: {
      name: 'Aquarium Hobbyist',
      email: 'user@aquariumstore.com',
      phone: '+911234567891',
      password: userPassword,
      role: Role.USER,
      isVerified: true,
    },
  });
  console.log(`User created: ${user.email}`);

  const categories: Array<{ name: string; description: string; subs: string[] }> = [
    { name: 'Fish & Livestock', description: 'Freshwater fish, shrimp, and snails', subs: ['Live Fish', 'Shrimp & Invertebrates', 'Live Plants'] },
    { name: 'Aquariums & Tanks', description: 'Glass tanks, complete kits, and stands', subs: ['Fish Tanks', 'Tank Kits', 'Stands & Cabinets'] },
    { name: 'Filtration', description: 'Keep water crystal clear and healthy', subs: ['Canister Filters', 'HOB Filters', 'Filter Media'] },
    { name: 'Water Treatment', description: 'Conditioners, bacteria, and test kits', subs: ['Water Conditioners', 'Beneficial Bacteria', 'Test Kits'] },
    { name: 'Heating & Lighting', description: 'Heaters, thermometers, and LED lights', subs: ['Aquarium Heaters', 'LED Lighting', 'Thermometers'] },
    { name: 'Decor & Substrate', description: 'Gravel, driftwood, rocks, and ornaments', subs: ['Substrate & Gravel', 'Driftwood & Rocks', 'Ornaments'] },
    { name: 'Food & Nutrition', description: 'Flakes, pellets, and treats for all fish', subs: ['Flakes', 'Pellets & Granules', 'Frozen & Live Food'] },
  ];

  const createdCategories: Record<string, { id: string; subs: Record<string, string> }> = {};
  for (const c of categories) {
    const created = await prisma.category.create({
      data: {
        name: c.name,
        description: c.description,
        subcategories: { create: c.subs.map((s) => ({ name: s, isActive: true })) },
      },
      include: { subcategories: true },
    });
    createdCategories[c.name] = { id: created.id, subs: Object.fromEntries(created.subcategories.map((s) => [s.name, s.id])) };
    console.log(`Category: ${c.name} (+${created.subcategories.length} subcategories)`);
  }

  const productsData: Array<{
    title: string;
    description: string;
    price: number;
    imageUrl: string;
    stock: number;
    category: string;
    sub: string;
    variants?: Array<{ name: string; price?: number; stock: number }>;
  }> = [
    {
      title: 'Neon Tetra',
      description: 'Small peaceful schooling fish with a glowing blue-red stripe.',
      price: 2.99,
      imageUrl: 'https://images.unsplash.com/photo-1691387668414-8f142b0aa76c?w=800&q=80',
      stock: 500,
      category: 'Fish & Livestock',
      sub: 'Live Fish',
    },
    {
      title: 'Betta Fish (Male)',
      description: 'Vibrant male betta, available in many colors.',
      price: 12.99,
      imageUrl: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&q=80',
      stock: 120,
      category: 'Fish & Livestock',
      sub: 'Live Fish',
      variants: [
        { name: 'Red', stock: 40 },
        { name: 'Blue', stock: 40 },
        { name: 'Turquoise', stock: 40 },
      ],
    },
    {
      title: 'Goldfish (Common)',
      description: 'Hardy, classic goldfish, perfect for beginners.',
      price: 4.99,
      imageUrl: 'https://images.unsplash.com/photo-1668862347626-70a980820f06?w=800&q=80',
      stock: 200,
      category: 'Fish & Livestock',
      sub: 'Live Fish',
    },
    {
      title: 'Amano Shrimp',
      description: 'Algae-eating shrimp that keep the tank clean.',
      price: 5.99,
      imageUrl: 'https://images.unsplash.com/photo-1711612901199-ffad39e8aa13?w=800&q=80',
      stock: 150,
      category: 'Fish & Livestock',
      sub: 'Shrimp & Invertebrates',
    },
    {
      title: 'Red Cherry Shrimp',
      description: 'Bright red dwarf shrimp, great for planted tanks.',
      price: 6.99,
      imageUrl: 'https://images.unsplash.com/photo-1703319959677-b8dd4f14c80e?w=800&q=80',
      stock: 150,
      category: 'Fish & Livestock',
      sub: 'Shrimp & Invertebrates',
    },
    {
      title: 'Anubias Nana Plant',
      description: 'Low-light hardy plant, attaches to wood or rock.',
      price: 8.99,
      imageUrl: 'https://images.unsplash.com/photo-1654621883904-e84d8c2bc2b4?w=800&q=80',
      stock: 80,
      category: 'Fish & Livestock',
      sub: 'Live Plants',
    },
    {
      title: 'Java Fern',
      description: 'Easy low-light plant, ideal for beginners.',
      price: 7.49,
      imageUrl: 'https://images.unsplash.com/photo-1630094129983-2c90e1fa129d?w=800&q=80',
      stock: 90,
      category: 'Fish & Livestock',
      sub: 'Live Plants',
    },
    {
      title: '10 Gallon Aquarium Kit',
      description: 'Complete starter kit with filter, LED light, and lid.',
      price: 129.99,
      imageUrl: 'https://images.unsplash.com/photo-1583949184685-33fda190a216?w=800&q=80',
      stock: 40,
      category: 'Aquariums & Tanks',
      sub: 'Tank Kits',
    },
    {
      title: '20 Gallon Glass Tank',
      description: 'Standard 20-gallon rectangular glass aquarium.',
      price: 89.99,
      imageUrl: 'https://images.unsplash.com/photo-1711539137981-ddf32f60c77b?w=800&q=80',
      stock: 30,
      category: 'Aquariums & Tanks',
      sub: 'Fish Tanks',
    },
    {
      title: '55 Gallon Display Tank',
      description: 'Large display aquarium for bigger communities.',
      price: 249.99,
      imageUrl: 'https://images.unsplash.com/photo-1514503180323-5097b045d4b7?w=800&q=80',
      stock: 15,
      category: 'Aquariums & Tanks',
      sub: 'Fish Tanks',
    },
    {
      title: 'Aquarium Stand (up to 20G)',
      description: 'Sturdy wooden stand with cabinet storage.',
      price: 79.99,
      imageUrl: 'https://images.unsplash.com/photo-1693892985308-44965a6060d1?w=800&q=80',
      stock: 20,
      category: 'Aquariums & Tanks',
      sub: 'Stands & Cabinets',
    },
    {
      title: 'Canister Filter 400',
      description: 'Powerful canister filter for tanks up to 100 gallons.',
      price: 159.99,
      imageUrl: 'https://images.unsplash.com/photo-1568668545393-54b82b43c088?w=800&q=80',
      stock: 25,
      category: 'Filtration',
      sub: 'Canister Filters',
    },
    {
      title: 'HOB Power Filter',
      description: 'Hang-on-back filter, 3-stage, quiet operation.',
      price: 39.99,
      imageUrl: 'https://images.unsplash.com/photo-1599492816933-2101fe60bc72?w=800&q=80',
      stock: 60,
      category: 'Filtration',
      sub: 'HOB Filters',
      variants: [
        { name: 'For 10-30G', price: 39.99, stock: 30 },
        { name: 'For 30-60G', price: 54.99, stock: 30 },
      ],
    },
    {
      title: 'Bio Media Pack',
      description: 'Ceramic bio rings for nitrifying bacteria.',
      price: 12.99,
      imageUrl: 'https://images.unsplash.com/photo-1596487162379-fbab6c590a42?w=800&q=80',
      stock: 100,
      category: 'Filtration',
      sub: 'Filter Media',
    },
    {
      title: 'Water Conditioner (250ml)',
      description: 'Removes chlorine and heavy metals instantly.',
      price: 9.99,
      imageUrl: 'https://images.unsplash.com/photo-1743333601396-9fc5cf8ec344?w=800&q=80',
      stock: 120,
      category: 'Water Treatment',
      sub: 'Water Conditioners',
    },
    {
      title: 'Cycle Starter Bacteria',
      description: 'Live bacteria to speed up tank cycling.',
      price: 11.99,
      imageUrl: 'https://images.unsplash.com/photo-1725992779007-13df60ca171b?w=800&q=80',
      stock: 80,
      category: 'Water Treatment',
      sub: 'Beneficial Bacteria',
    },
    {
      title: 'Master Test Kit',
      description: 'Tests pH, ammonia, nitrite, and nitrate.',
      price: 34.99,
      imageUrl: 'https://images.unsplash.com/photo-1782320400061-fbbf7a6098f4?w=800&q=80',
      stock: 45,
      category: 'Water Treatment',
      sub: 'Test Kits',
    },
    {
      title: '100W Submersible Heater',
      description: 'Adjustable heater with auto shut-off for tanks up to 40G.',
      price: 24.99,
      imageUrl: 'https://images.unsplash.com/photo-1520366498724-709889c0c685?w=800&q=80',
      stock: 70,
      category: 'Heating & Lighting',
      sub: 'Aquarium Heaters',
      variants: [
        { name: '50W (up to 20G)', price: 19.99, stock: 35 },
        { name: '100W (up to 40G)', price: 24.99, stock: 35 },
      ],
    },
    {
      title: 'Full Spectrum LED Bar',
      description: 'Adjustable brightness LED for planted tanks.',
      price: 59.99,
      imageUrl: 'https://images.unsplash.com/photo-1578313097818-dfe8d38aa758?w=800&q=80',
      stock: 40,
      category: 'Heating & Lighting',
      sub: 'LED Lighting',
      variants: [
        { name: '18 inch', price: 49.99, stock: 20 },
        { name: '24 inch', price: 59.99, stock: 20 },
      ],
    },
    {
      title: 'Digital Thermometer',
      description: 'Accurate digital thermometer with suction mount.',
      price: 7.99,
      imageUrl: 'https://images.unsplash.com/photo-1585437896043-ddf644a92aaf?w=800&q=80',
      stock: 150,
      category: 'Heating & Lighting',
      sub: 'Thermometers',
    },
    {
      title: 'Natural Sand Substrate (10lb)',
      description: 'Fine natural sand, safe for bottom dwellers.',
      price: 14.99,
      imageUrl: 'https://images.unsplash.com/photo-1599363155446-6b8863475001?w=800&q=80',
      stock: 80,
      category: 'Decor & Substrate',
      sub: 'Substrate & Gravel',
      variants: [
        { name: 'Natural', stock: 40 },
        { name: 'Black', stock: 40 },
      ],
    },
    {
      title: 'Malaysian Driftwood (Large)',
      description: 'Natural driftwood that releases tannins and shapes the scape.',
      price: 19.99,
      imageUrl: 'https://images.unsplash.com/photo-1534563846078-f88f34903f79?w=800&q=80',
      stock: 35,
      category: 'Decor & Substrate',
      sub: 'Driftwood & Rocks',
    },
    {
      title: 'Sunken Ship Ornament',
      description: 'Resin shipwreck ornament with hiding caves.',
      price: 16.99,
      imageUrl: 'https://images.unsplash.com/photo-1573553467420-b2a90be8d317?w=800&q=80',
      stock: 50,
      category: 'Decor & Substrate',
      sub: 'Ornaments',
    },
    {
      title: 'Tropical Flakes (100g)',
      description: 'Daily staple flakes for all tropical fish.',
      price: 6.99,
      imageUrl: 'https://images.unsplash.com/photo-1607629194620-a9726803827c?w=800&q=80',
      stock: 200,
      category: 'Food & Nutrition',
      sub: 'Flakes',
    },
    {
      title: 'Cichlid Pellets (250g)',
      description: 'High-protein sinking pellets for cichlids.',
      price: 9.49,
      imageUrl: 'https://images.unsplash.com/photo-1543285129-bfdac0db10b2?w=800&q=80',
      stock: 100,
      category: 'Food & Nutrition',
      sub: 'Pellets & Granules',
    },
    {
      title: 'Freeze-Dried Bloodworms (40g)',
      description: 'Protein-rich treat fish love.',
      price: 5.99,
      imageUrl: 'https://images.unsplash.com/photo-1719240215949-1cb1fd37915b?w=800&q=80',
      stock: 90,
      category: 'Food & Nutrition',
      sub: 'Frozen & Live Food',
    },
  ];

  const products: Record<string, { id: string; price: number; variantIds: string[] }> = {};
  for (const p of productsData) {
    const cat = createdCategories[p.category];
    const created = await prisma.product.create({
      data: {
        title: p.title,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        stock: p.stock,
        categoryId: cat.id,
        subcategoryId: cat.subs[p.sub],
        variants: p.variants
          ? { create: p.variants.map((v) => ({ name: v.name, price: v.price, stock: v.stock })) }
          : undefined,
      },
      include: { variants: true },
    });
    products[p.title] = { id: created.id, price: created.price, variantIds: created.variants.map((v) => v.id) };
  }
  console.log(`Products seeded: ${Object.keys(products).length}`);

  const coupons = [
    { code: 'FISH10', discountType: 'PERCENTAGE' as const, discountValue: 10, minOrderAmount: 500, maxDiscount: 100, usageLimit: 1000 },
    { code: 'TANK50', discountType: 'FLAT' as const, discountValue: 50, minOrderAmount: 300, usageLimit: 500 },
    { code: 'REEF20', discountType: 'PERCENTAGE' as const, discountValue: 20, minOrderAmount: 1000, maxDiscount: 300, usageLimit: 200 },
    { code: 'POND15', discountType: 'PERCENTAGE' as const, discountValue: 15, minOrderAmount: 200, maxDiscount: 150, usageLimit: 100 },
  ];
  const couponIds: string[] = [];
  for (const c of coupons) {
    const created = await prisma.coupon.create({
      data: {
        ...c,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
    couponIds.push(created.id);
  }
  console.log(`Coupons seeded: ${couponIds.length}`);

  const tickets = [
    { subject: 'Fish arrived DOA', description: 'My neon tetras died in transit.', priority: 'URGENT' as const },
    { subject: 'Filter making noise', description: 'Canister filter hums loudly.', priority: 'MEDIUM' as const },
    { subject: 'Cycling advice', description: 'Need help speeding up tank cycle.', priority: 'LOW' as const },
  ];
  const ticketIds: string[] = [];
  for (const t of tickets) {
    const created = await prisma.supportTicket.create({
      data: { ...t, userId: user.id, status: 'OPEN', replies: { create: [{ message: 'Thanks for reaching out, we are looking into it.', userId: admin.id, isAdmin: true }] } },
    });
    ticketIds.push(created.id);
  }
  console.log(`Support tickets seeded: ${ticketIds.length}`);

  await prisma.auditLog.createMany({
    data: [
      { action: 'CREATE', entity: 'Product', entityId: products['Neon Tetra'].id, userId: admin.id, newValue: { title: 'Neon Tetra' } },
      { action: 'UPDATE', entity: 'Category', entityId: createdCategories['Fish & Livestock'].id, userId: admin.id, newValue: { isActive: true } },
      { action: 'CREATE', entity: 'Coupon', entityId: couponIds[0], userId: admin.id, newValue: { code: 'FISH10' } },
    ],
  });
  console.log('Audit logs seeded: 3');

  const cart = await prisma.cart.create({
    data: {
      userId: user.id,
      items: {
        create: [
          { productId: products['Neon Tetra'].id, quantity: 6 },
          { productId: products['Water Conditioner (250ml)'].id, quantity: 1 },
          { productId: products['Master Test Kit'].id, quantity: 1 },
        ],
      },
    },
  });
  console.log(`Cart seeded for user: ${cart.userId}`);

  await prisma.wishlistItem.createMany({
    data: [
      { userId: user.id, productId: products['Amano Shrimp'].id },
      { userId: user.id, productId: products['55 Gallon Display Tank'].id },
    ],
  });
  console.log('Wishlist seeded: 2 items');

  await prisma.review.createMany({
    data: [
      { rating: 5, comment: 'Healthy fish, great packaging, arrived alive!', userId: user.id, productId: products['Neon Tetra'].id },
      { rating: 4, comment: 'Easy to use, water cleared fast.', userId: user.id, productId: products['Water Conditioner (250ml)'].id },
      { rating: 5, comment: 'Accurate and easy to read results.', userId: user.id, productId: products['Master Test Kit'].id },
    ],
  });
  console.log('Reviews seeded: 3');

  const orderData = [
    {
      total: 44.97,
      discount: 0,
      status: 'DELIVERED' as const,
      items: [
        { productId: products['Neon Tetra'].id, quantity: 6, price: 2.99 },
        { productId: products['Anubias Nana Plant'].id, quantity: 3, price: 8.99 },
      ],
      payStatus: 'PAID' as const,
      log: [
        { status: 'PENDING' as const, note: 'Order placed' },
        { status: 'APPROVED' as const, note: 'Approved by admin' },
        { status: 'DELIVERED' as const, note: 'Delivered successfully' },
      ],
    },
    {
      total: 161.98,
      discount: 18.0,
      status: 'SHIPPED' as const,
      couponId: couponIds[0],
      items: [
        { productId: products['10 Gallon Aquarium Kit'].id, quantity: 1, price: 129.99 },
        { productId: products['Water Conditioner (250ml)'].id, quantity: 1, price: 9.99 },
        { productId: products['Tropical Flakes (100g)'].id, quantity: 1, price: 6.99 },
      ],
      payStatus: 'PAID' as const,
      log: [
        { status: 'PENDING' as const, note: 'Order placed' },
        { status: 'APPROVED' as const, note: 'Approved by admin' },
        { status: 'SHIPPED' as const, note: 'Handed to courier (AWB 123456789)' },
      ],
    },
    {
      total: 34.99,
      discount: 0,
      status: 'PENDING' as const,
      items: [{ productId: products['Master Test Kit'].id, quantity: 1, price: 34.99 }],
      payStatus: 'PENDING' as const,
      log: [{ status: 'PENDING' as const, note: 'Order placed' }],
    },
  ];

  const orderIds: string[] = [];
  for (const o of orderData) {
    const created = await prisma.order.create({
      data: {
        userId: user.id,
        total: o.total,
        discount: o.discount,
        couponId: o.couponId,
        status: o.status,
        address: '42 Aquarium Lane, Bengaluru 560001',
        phone: '+911234567891',
        items: { create: o.items },
        payment: { create: { method: 'ONLINE', status: o.payStatus, transactionId: `TXN${Math.floor(Math.random() * 1e9)}`, paidAt: o.payStatus === 'PAID' ? new Date() : null } },
        statusLog: { create: o.log },
      },
    });
    orderIds.push(created.id);
    console.log(`Order seeded: ${created.id} (${o.status})`);
  }

  await prisma.returnRequest.create({
    data: {
      orderId: orderIds[2],
      userId: user.id,
      reason: 'Changed my mind about the purchase.',
      status: 'PENDING',
    },
  });
  console.log('Return request seeded: 1');

  console.log('Seeding completed successfully!');
  console.log(`Admin login: ${process.env.ADMIN_EMAIL ?? 'admin@aquariumstore.com'} / ${process.env.ADMIN_PASSWORD ?? 'Admin@123'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
