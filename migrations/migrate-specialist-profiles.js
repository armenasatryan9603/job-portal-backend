const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateSpecialistProfiles() {
  try {
    console.log('Starting migration of specialist profiles to users table...');

    // First, get all specialist profiles
    const specialistProfiles = await prisma.specialistProfile.findMany({
      include: {
        User: true,
        Service: true,
      },
    });

    console.log(
      `Found ${specialistProfiles.length} specialist profiles to migrate`,
    );

    // Update each user with specialist profile data
    for (const profile of specialistProfiles) {
      console.log(
        `Migrating profile for user ${profile.User.id} (${profile.User.name})`,
      );

      await prisma.user.update({
        where: { id: profile.userId },
        data: {
          serviceId: profile.serviceId,
          experienceYears: profile.experienceYears,
          priceMin: profile.priceMin,
          priceMax: profile.priceMax,
          location: profile.location,
        },
      });
    }

    // Update OrderProposal records to use userId instead of specialistProfileId
    console.log('Updating OrderProposal records...');

    const proposals = await prisma.orderProposal.findMany({
      where: {
        specialistProfileId: { not: null },
      },
    });

    for (const proposal of proposals) {
      // Find the specialist profile to get the userId
      const specialistProfile = await prisma.specialistProfile.findUnique({
        where: { id: proposal.specialistProfileId },
      });

      if (specialistProfile) {
        await prisma.orderProposal.update({
          where: { id: proposal.id },
          data: {
            userId: specialistProfile.userId,
            specialistProfileId: null, // Remove the old field
          },
        });
      }
    }

    console.log('Migration completed successfully!');
    console.log('You can now run: npx prisma db push');
    console.log(
      'And then remove the specialist-profiles module from your codebase.',
    );
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateSpecialistProfiles().catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});

