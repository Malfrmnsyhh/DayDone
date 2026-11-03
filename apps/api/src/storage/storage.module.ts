import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { GoogleDriveStorage } from './google-drive.storage.js';
import { STORAGE_PROVIDER } from './storage.interface.js';

@Module({
  imports: [CommonModule],
  providers: [
    GoogleDriveStorage,
    {
      provide: STORAGE_PROVIDER,
      useClass: GoogleDriveStorage,
    },
  ],
  exports: [STORAGE_PROVIDER, GoogleDriveStorage],
})
export class StorageModule {}
