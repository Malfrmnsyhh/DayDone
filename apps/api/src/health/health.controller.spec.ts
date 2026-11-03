import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health status ok with timestamp', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

