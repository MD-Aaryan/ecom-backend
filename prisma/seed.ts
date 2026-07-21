import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Sample Regular User (Admin is managed via .env only)
  const userPassword = await bcrypt.hash('User@12345', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      name: 'Test User',
      email: 'user@example.com',
      phone: '+1234567890',
      password: userPassword,
      role: Role.USER,
      isVerified: true,
    },
  });
  console.log(`User created: ${user.email}`);

  // Create Default Category & Subcategory
  const category = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: {
      name: 'Electronics',
      description: 'Gadgets, phones, and devices',
      subcategories: {
        create: [
          { name: 'Mobile Phones' },
          { name: 'Laptops' },
        ],
      },
    },
    include: { subcategories: true },
  });
  console.log(`Category created: ${category.name}`);

  // Create Sample Product
  const subcategory = category.subcategories[0];
  const product = await prisma.product.create({
    data: {
      title: 'Flagship Smartphone X',
      description: 'High performance smartphone with 108MP camera and 5000mAh battery.',
      price: 699.99,
      imageUrl: 'https://via.placeholder.com/600',
      stock: 50,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      variants: {
        create: [
          { name: '128GB Black', price: 699.99, stock: 30 },
          { name: '256GB Silver', price: 799.99, stock: 20 },
        ],
      },
    },
  });
  console.log(`Sample product created: ${product.title}`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
