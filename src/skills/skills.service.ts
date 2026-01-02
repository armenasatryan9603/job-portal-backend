import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new skill
   */
  async createSkill(createSkillDto: CreateSkillDto) {
    return (this.prisma as any).skill.create({
      data: createSkillDto,
    });
  }

  /**
   * Get all skills with pagination
   */
  async findAll(page: number = 1, limit: number = 100, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameRu: { contains: search, mode: 'insensitive' } },
        { nameHy: { contains: search, mode: 'insensitive' } },
        { descriptionEn: { contains: search, mode: 'insensitive' } },
        { descriptionRu: { contains: search, mode: 'insensitive' } },
        { descriptionHy: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [skills, total] = await Promise.all([
      (this.prisma as any).skill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nameEn: 'asc' },
      }),
      (this.prisma as any).skill.count({ where }),
    ]);

    return {
      skills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get a single skill by ID
   */
  async findOne(id: number) {
    const skill = await (this.prisma as any).skill.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            OrderSkills: true,
          },
        },
      },
    });

    if (!skill) {
      throw new NotFoundException(`Skill with ID ${id} not found`);
    }

    return skill;
  }

  /**
   * Update a skill
   */
  async updateSkill(id: number, updateSkillDto: UpdateSkillDto) {
    const skill = await this.findOne(id);

    return (this.prisma as any).skill.update({
      where: { id },
      data: updateSkillDto,
    });
  }

  /**
   * Delete a skill
   */
  async deleteSkill(id: number) {
    const skill = await this.findOne(id);

    // Check if skill is being used in any orders
    const orderSkillsCount = await (this.prisma as any).orderSkill.count({
      where: { skillId: id },
    });

    if (orderSkillsCount > 0) {
      throw new BadRequestException(
        `Cannot delete skill: it is used in ${orderSkillsCount} order(s)`,
      );
    }

    return (this.prisma as any).skill.delete({
      where: { id },
    });
  }

  /**
   * Search skills for autocomplete (searches across all languages)
   */
  async searchSkills(query: string, limit: number = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim();

    const skills = await (this.prisma as any).skill.findMany({
      where: {
        OR: [
          { nameEn: { contains: searchTerm, mode: 'insensitive' } },
          { nameRu: { contains: searchTerm, mode: 'insensitive' } },
          { nameHy: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { nameEn: 'asc' },
    });

    return skills;
  }

  /**
   * Find or create a skill by name
   * Used when creating orders with skill names
   */
  async findOrCreateSkill(skillName: string) {
    if (!skillName || skillName.trim().length === 0) {
      throw new BadRequestException('Skill name cannot be empty');
    }

    const trimmedName = skillName.trim();

    // Try to find existing skill by any language name
    let skill = await (this.prisma as any).skill.findFirst({
      where: {
        OR: [
          { nameEn: trimmedName },
          { nameRu: trimmedName },
          { nameHy: trimmedName },
        ],
      },
    });

    // If not found, create a new skill with the same name in all languages
    if (!skill) {
      skill = await (this.prisma as any).skill.create({
        data: {
          nameEn: trimmedName,
          nameRu: trimmedName,
          nameHy: trimmedName,
        },
      });
    }

    return skill;
  }

  /**
   * Find or create multiple skills by names
   */
  async findOrCreateSkills(skillNames: string[]) {
    const skills = await Promise.all(
      skillNames.map((name) => this.findOrCreateSkill(name)),
    );
    return skills;
  }
}

