import { ResetPasswordConfirmForm } from "./ResetPasswordConfirmForm";

export default async function ResetPasswordConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>

        {token ? (
          <ResetPasswordConfirmForm token={token} />
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            This reset link is missing its token. Request a new one from the{" "}
            <a href="/reset-password" className="text-brand-600 hover:underline">
              reset password
            </a>{" "}
            page.
          </p>
        )}
      </div>
    </div>
  );
}
