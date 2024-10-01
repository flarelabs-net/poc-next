export const config = { runtime: "experimental-edge" };

export async function getServerSideProps() {
  return {
    props: { serverTime: new Date().toISOString() },
  };
}

export default function PageA({ serverTime }: { serverTime: string }) {
  return (
    <h1>
      The server time is: <>{serverTime}</>
    </h1>
  );
}
