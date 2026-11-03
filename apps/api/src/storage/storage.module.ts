import { Global, Module } from '@nestjs/common';
import { GoogleDriveStorage } from './google-drive.storage.js';
import { STORAGE_PROVIDER } from './storage.interface.js';

@Global()
@Module({
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

