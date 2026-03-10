import Link from 'next/link';

export default function NativeWindPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">UI Playground</h1>
      <p className="mt-2 text-gray-600">A demonstração NativeWind foi simplificada para o novo workspace de chat.</p>
      <Link className="mt-4 inline-block rounded bg-black px-4 py-2 text-white" href="/">
        Ir para tela principal
      </Link>
    </main>
  );
}
