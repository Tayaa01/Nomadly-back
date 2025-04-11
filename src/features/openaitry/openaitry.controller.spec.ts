import { Test, TestingModule } from '@nestjs/testing';
import { OpenaitryController } from './openaitry.controller';

describe('OpenaitryController', () => {
  let controller: OpenaitryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenaitryController],
    }).compile();

    controller = module.get<OpenaitryController>(OpenaitryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
