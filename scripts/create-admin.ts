import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin User';

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    if (existingAdmin.role === 'admin') {
      console.log('✅ Admin user already exists:', email);
      return;
    } else {
      // Update existing user to admin
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: 'admin',
          passwordHash: hashedPassword,
        },
      });
      console.log('✅ Updated user to admin:', email);
      console.log('📧 Email:', email);
      console.log('🔑 Password:', password);
      return;
    }
  }

  // Create new admin user
  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashedPassword,
      role: 'admin',
      creditBalance: 0,
      verified: true,
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('📧 Email:', email);
  console.log('🔑 Password:', password);
  console.log('🆔 User ID:', admin.id);
}

createAdmin()
  .catch((e) => {
    console.error('❌ Error creating admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
