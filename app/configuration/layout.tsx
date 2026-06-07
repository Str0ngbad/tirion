import { ConfigurationSubNav } from './_components/configuration-sub-nav';

export default function ConfigurationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col">
      <ConfigurationSubNav />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
