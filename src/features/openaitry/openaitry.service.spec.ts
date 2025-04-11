import { Test, TestingModule } from '@nestjs/testing';
import { OpenaitryService } from './openaitry.service';

describe('OpenaitryService', () => {
  let service: OpenaitryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenaitryService],
    }).compile();

    service = module.get<OpenaitryService>(OpenaitryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
