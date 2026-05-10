import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  tools: string[]; // Tool IDs this skill provides
  prompts: Record<string, string>; // Named prompt templates
  execute?(action: string, args: Record<string, any>): Promise<any>;
}

export class SkillRegistry extends EventEmitter {
  private skills = new Map<string, Skill>();
  private registryUrl: string = '';

  setRegistry(url: string): void {
    this.registryUrl = url;
  }

  async load(skillId: string): Promise<void> {
    // Try built-in skills first
    const builtIn = this.getBuiltInSkill(skillId);
    if (builtIn) {
      this.skills.set(skillId, builtIn);
      console.log(`[skills] loaded built-in: ${skillId}`);
      return;
    }

    // Try local cache
    const localPath = path.join(process.env.NEXORIA_SKILLS_DIR || './skills', skillId);
    try {
      const manifestPath = path.join(localPath, 'skill.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      const skill: Skill = {
        id: skillId,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        tools: manifest.tools || [],
        prompts: manifest.prompts || {},
      };

      this.skills.set(skillId, skill);
      console.log(`[skills] loaded local: ${skillId} v${skill.version}`);
    } catch (err) {
      console.warn(`[skills] failed to load ${skillId}:`, err);
    }
  }

  private getBuiltInSkill(skillId: string): Skill | null {
    const skills: Record<string, Skill> = {
      'crypto-researcher': {
        id: 'crypto-researcher',
        name: 'Crypto Researcher',
        description: 'Research crypto markets, prices, trends',
        version: '1.0.0',
        tools: ['web_search'],
        prompts: {
          research: 'Research the following crypto topic: {{topic}}',
          analysis: 'Analyze market data: {{data}}',
        },
      },
      'social-media-manager': {
        id: 'social-media-manager',
        name: 'Social Media Manager',
        description: 'Create and manage social media posts',
        version: '1.0.0',
        tools: ['nexoria_api'],
        prompts: {
          draft_post: 'Draft a {{platform}} post about: {{topic}}',
          schedule_post: 'Schedule this post for: {{datetime}}',
        },
      },
      'content-creator': {
        id: 'content-creator',
        name: 'Content Creator',
        description: 'Create blog posts, emails, and articles',
        version: '1.0.0',
        tools: ['file_write', 'nexoria_api'],
        prompts: {
          write_blog: 'Write a blog post about: {{topic}}',
          write_email: 'Write an email: {{brief}}',
        },
      },
    };
    return skills[skillId] || null;
  }

  list(): string[] {
    return Array.from(this.skills.keys());
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  async install(skillId: string, source?: string): Promise<void> {
    // Download and install skill from registry
    const installUrl = source || `${this.registryUrl}/skills/${skillId}`;
    console.log(`[skills] installing ${skillId} from ${installUrl}`);
    
    // TODO: Implement download + unpack
    // For now, just mark as needing implementation
    throw new Error(`Skill install not yet implemented: ${skillId}`);
  }
}
