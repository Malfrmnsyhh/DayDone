/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initCodeClient: (config: {
          client_id: string;
          scope: string;
          ux_mode?: 'popup' | 'redirect';
          prompt?: string;
          callback: (response: { code?: string; error?: string }) => void;
          error_callback?: (error: unknown) => void;
        }) => {
          requestCode: () => void;
        };
      };
    };
  };
}
