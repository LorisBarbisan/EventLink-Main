import { Layout } from "@/components/Layout";
import { HeroSection } from "@/components/HeroSection";
import { usePageSeo, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "@/hooks/usePageSeo";

const Index = () => {
  usePageSeo(DEFAULT_TITLE, DEFAULT_DESCRIPTION);
  return (
    <Layout>
      <HeroSection />
    </Layout>
  );
};

export default Index;
