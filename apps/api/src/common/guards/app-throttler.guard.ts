import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    const isTest = process.env.NODE_ENV === 'test';
    const forceEnabled = process.env.THROTTLER_FORCE_ENABLED === 'true';

    // Longgarkan/lewati pemeriksaan saat menjalankan test umum agar tidak flaky
    if (isTest && !forceEnabled) {
      return true;
    }

    return super.shouldSkip(context);
  }
}

