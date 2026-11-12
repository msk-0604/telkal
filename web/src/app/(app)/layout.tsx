import { Suspense } from "react";
import { ApiTimingIndicator, HomeLink, UserMenu } from "@/components/app-header";
import { CreateCustomerButton, CreateCustomerProvider } from "@/components/create-customer";
import { getCurrentUser } from "@/lib/server/auth";

async function CurrentUserMenu() {
  const me = await getCurrentUser();
  return <UserMenu me={me} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <CreateCustomerProvider>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <HomeLink />
          <div className="flex items-center gap-1 sm:gap-2">
            <Suspense fallback={<div className="h-10 w-10" aria-hidden />}>
              <CurrentUserMenu />
            </Suspense>
            <CreateCustomerButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="px-4 pb-6">
        <ApiTimingIndicator />
      </footer>
    </CreateCustomerProvider>
  );
}
