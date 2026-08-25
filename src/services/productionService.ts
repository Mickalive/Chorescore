import type {
  AppDataService,
  CompleteTimerInput,
  CreateTaskInput,
  EditEntryDurationInput,
  ManualEntryInput,
  StartTimerInput,
  UpdateTaskInput,
} from './appService';
import { ProductionModeDisabledError } from './appService';

export class ProductionAppService implements AppDataService {
  readonly mode = 'production-disabled' as const;

  getInitialSnapshot(): never {
    throw new ProductionModeDisabledError();
  }

  createTask(_input: CreateTaskInput): never {
    throw new ProductionModeDisabledError();
  }

  startTimer(_input: StartTimerInput): never {
    throw new ProductionModeDisabledError();
  }

  completeTimer(_input: CompleteTimerInput): never {
    throw new ProductionModeDisabledError();
  }

  createManualEntry(_input: ManualEntryInput): never {
    throw new ProductionModeDisabledError();
  }

  updateTask(_input: UpdateTaskInput): never {
    throw new ProductionModeDisabledError();
  }

  editCompletedEntryDuration(_input: EditEntryDurationInput): never {
    throw new ProductionModeDisabledError();
  }
}
