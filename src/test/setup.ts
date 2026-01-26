import "@testing-library/jest-dom";

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Mock navigator.locks for Supabase Auth
if (typeof global.navigator === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.navigator = {} as any;
}
if (!global.navigator.locks) {
  Object.defineProperty(global.navigator, "locks", {
    value: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request: async (
        _name: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _optionsOrCallback: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback?: any,
      ) => {
        const cb = callback || _optionsOrCallback;
        if (typeof cb === "function") {
          return cb();
        }
      },
      query: async () => ({
        held: [],
        pending: [],
      }),
    },
    writable: true,
  });
}
