import { Search } from "lucide-react";
import { useLocation } from "wouter";

export const SearchBar = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="hidden sm:flex items-center space-x-2 bg-muted rounded-lg px-3 py-2">
      <Search className="w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search jobs..."
        className="bg-transparent border-none outline-none text-sm w-24 xl:w-32"
        data-testid="input-search"
        onKeyDown={e => {
          if (e.key === "Enter") {
            const query = e.currentTarget.value.trim();
            if (query) {
              setLocation(`/jobs?search=${encodeURIComponent(query)}`);
            }
          }
        }}
      />
    </div>
  );
};
