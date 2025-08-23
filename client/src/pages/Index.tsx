import { Layout } from "@/components/Layout";

const Index = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-bold">Welcome to E8</h1>
          <p className="text-xl text-muted-foreground">The platform is loading...</p>
          <div className="space-y-4">
            <p>If you see this message, the React app is working!</p>
            <p>Testing basic functionality...</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
