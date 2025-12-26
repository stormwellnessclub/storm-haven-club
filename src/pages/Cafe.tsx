import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  calories?: number;
  dietary?: string[];
}

const menuItems: MenuItem[] = [
  // Smoothies
  {
    id: 1,
    name: "Green Storm",
    description: "Spinach, kale, banana, mango, coconut water",
    price: 9.50,
    category: "Smoothies",
    calories: 180,
    dietary: ["Vegan", "GF"],
  },
  {
    id: 2,
    name: "Berry Blast",
    description: "Mixed berries, acai, almond milk, honey",
    price: 10.00,
    category: "Smoothies",
    calories: 220,
    dietary: ["GF"],
  },
  {
    id: 3,
    name: "Protein Power",
    description: "Banana, peanut butter, oat milk, whey protein, cacao",
    price: 12.00,
    category: "Smoothies",
    calories: 350,
    dietary: ["GF"],
  },
  // Fresh Juices
  {
    id: 4,
    name: "Immunity Boost",
    description: "Orange, carrot, ginger, turmeric",
    price: 8.00,
    category: "Fresh Juices",
    calories: 120,
    dietary: ["Vegan", "GF"],
  },
  {
    id: 5,
    name: "Green Machine",
    description: "Cucumber, celery, apple, lemon, mint",
    price: 8.50,
    category: "Fresh Juices",
    calories: 90,
    dietary: ["Vegan", "GF"],
  },
  // Bowls
  {
    id: 6,
    name: "Acai Bowl",
    description: "Acai blend, granola, fresh berries, honey, coconut flakes",
    price: 14.00,
    category: "Bowls",
    calories: 420,
    dietary: ["Vegan option", "GF"],
  },
  {
    id: 7,
    name: "Protein Bowl",
    description: "Quinoa, grilled chicken, avocado, roasted vegetables",
    price: 16.00,
    category: "Bowls",
    calories: 520,
    dietary: ["GF"],
  },
  {
    id: 8,
    name: "Buddha Bowl",
    description: "Brown rice, chickpeas, hummus, roasted veggies, tahini",
    price: 15.00,
    category: "Bowls",
    calories: 480,
    dietary: ["Vegan", "GF"],
  },
  // Light Bites
  {
    id: 9,
    name: "Avocado Toast",
    description: "Sourdough, smashed avocado, cherry tomatoes, microgreens",
    price: 11.00,
    category: "Light Bites",
    calories: 340,
    dietary: ["Vegan"],
  },
  {
    id: 10,
    name: "Energy Bites",
    description: "Date, almond, cacao, coconut (3 pieces)",
    price: 6.00,
    category: "Light Bites",
    calories: 180,
    dietary: ["Vegan", "GF"],
  },
  // Drinks
  {
    id: 11,
    name: "Matcha Latte",
    description: "Ceremonial grade matcha, oat milk",
    price: 6.50,
    category: "Drinks",
    calories: 140,
    dietary: ["Vegan", "GF"],
  },
  {
    id: 12,
    name: "Cold Brew",
    description: "House-made cold brew, available with oat milk",
    price: 5.00,
    category: "Drinks",
    calories: 5,
    dietary: ["Vegan", "GF"],
  },
];

const categories = ["All", "Smoothies", "Fresh Juices", "Bowls", "Light Bites", "Drinks"];

interface CartItem extends MenuItem {
  quantity: number;
}

export default function Cafe() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);

  const filteredItems = selectedCategory === "All"
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added to order`);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">The Storm Café</p>
            <h1 className="heading-display mb-6">Nourish From Within</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Fuel your wellness journey with our carefully curated menu of fresh juices, 
              smoothies, health bowls, and clean eating options.
            </p>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`filter-badge ${selectedCategory === category ? "filter-badge-active" : ""}`}
                >
                  {category}
                </button>
              ))}
            </div>
            {cartCount > 0 && (
              <div className="hidden md:flex items-center gap-2 text-sm">
                <ShoppingBag className="w-4 h-4" />
                <span>{cartCount} items</span>
                <span className="text-accent font-semibold">${cartTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Menu Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Menu Items */}
            <div className="lg:col-span-2">
              <div className="grid md:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="card-luxury p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-serif text-lg">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <span className="text-accent font-semibold">${item.price.toFixed(2)}</span>
                    </div>
                    
                    <p className="text-muted-foreground text-sm mb-3">{item.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.dietary?.map((d) => (
                          <span key={d} className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm">
                            {d}
                          </span>
                        ))}
                        {item.calories && (
                          <span className="text-xs text-muted-foreground">{item.calories} cal</span>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => addToCart(item)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="card-luxury p-6 sticky top-40">
                <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Your Order
                </h3>
                
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Your order is empty. Add items from the menu.
                  </p>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ${item.price.toFixed(2)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t border-border pt-4 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total</span>
                        <span className="text-accent font-semibold text-xl">
                          ${cartTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <Button className="w-full" size="lg">
                      Place Order
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
