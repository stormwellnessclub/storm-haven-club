import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AlertCircle, Check, Copy, Info, Palette, Type, Square, FormInput, Bell, Sparkles, Move, Layout as LayoutIcon } from "lucide-react";

// Color swatch component
function ColorSwatch({ name, variable, hsl, className }: { name: string; variable: string; hsl: string; className?: string }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(variable);
    toast.success(`Copied ${variable}`);
  };

  return (
    <div 
      className="group cursor-pointer"
      onClick={copyToClipboard}
    >
      <div 
        className={`h-20 rounded-lg border shadow-sm transition-transform group-hover:scale-105 ${className}`}
        style={{ backgroundColor: `hsl(${hsl})` }}
      />
      <div className="mt-2 space-y-0.5">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{variable}</p>
        <p className="text-xs text-muted-foreground">{hsl}</p>
      </div>
    </div>
  );
}

// Code block component
function CodeBlock({ code, language = "tsx" }: { code: string; language?: string }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="relative group">
      <pre className="bg-charcoal text-cream p-4 rounded-lg text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 bg-charcoal/50 hover:bg-charcoal/80 text-cream"
        onClick={copyToClipboard}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Section wrapper
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function DesignSystem() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [progress, setProgress] = useState(66);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-gradient-dark text-cream py-16">
          <div className="container mx-auto px-4">
            <h1 className="heading-display text-4xl md:text-5xl mb-4">Design System</h1>
            <p className="text-cream/80 text-lg max-w-2xl">
              Storm Wellness Club's comprehensive design system. All tokens, components, and patterns in one place.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <Tabs defaultValue="colors" className="space-y-8">
            <TabsList className="flex-wrap h-auto gap-2 bg-muted/50 p-2">
              <TabsTrigger value="colors" className="gap-2">
                <Palette className="h-4 w-4" />
                Colors
              </TabsTrigger>
              <TabsTrigger value="typography" className="gap-2">
                <Type className="h-4 w-4" />
                Typography
              </TabsTrigger>
              <TabsTrigger value="buttons" className="gap-2">
                <Square className="h-4 w-4" />
                Buttons
              </TabsTrigger>
              <TabsTrigger value="cards" className="gap-2">
                <LayoutIcon className="h-4 w-4" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="forms" className="gap-2">
                <FormInput className="h-4 w-4" />
                Forms
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-2">
                <Bell className="h-4 w-4" />
                Feedback
              </TabsTrigger>
              <TabsTrigger value="effects" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Effects
              </TabsTrigger>
              <TabsTrigger value="animations" className="gap-2">
                <Move className="h-4 w-4" />
                Animations
              </TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-12">
              <Section title="Brand Colors" description="Core brand identity colors used throughout the application.">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  <ColorSwatch name="Gold" variable="--gold" hsl="38 65% 50%" />
                  <ColorSwatch name="Gold Light" variable="--gold-light" hsl="40 60% 75%" />
                  <ColorSwatch name="Charcoal" variable="--charcoal" hsl="30 12% 18%" />
                  <ColorSwatch name="Cream" variable="--cream" hsl="38 30% 96%" />
                  <ColorSwatch name="Cream Dark" variable="--cream-dark" hsl="38 25% 90%" />
                  <ColorSwatch name="Warm Gray" variable="--warm-gray" hsl="30 10% 45%" />
                </div>
              </Section>

              <Separator />

              <Section title="Semantic Colors" description="Purpose-driven colors for consistent UI patterns.">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  <div>
                    <div className="h-20 rounded-lg bg-primary" />
                    <p className="mt-2 font-medium text-sm">Primary</p>
                    <p className="text-xs text-muted-foreground">bg-primary</p>
                  </div>
                  <div>
                    <div className="h-20 rounded-lg bg-secondary" />
                    <p className="mt-2 font-medium text-sm">Secondary</p>
                    <p className="text-xs text-muted-foreground">bg-secondary</p>
                  </div>
                  <div>
                    <div className="h-20 rounded-lg bg-muted" />
                    <p className="mt-2 font-medium text-sm">Muted</p>
                    <p className="text-xs text-muted-foreground">bg-muted</p>
                  </div>
                  <div>
                    <div className="h-20 rounded-lg bg-accent" />
                    <p className="mt-2 font-medium text-sm">Accent</p>
                    <p className="text-xs text-muted-foreground">bg-accent</p>
                  </div>
                  <div>
                    <div className="h-20 rounded-lg bg-destructive" />
                    <p className="mt-2 font-medium text-sm">Destructive</p>
                    <p className="text-xs text-muted-foreground">bg-destructive</p>
                  </div>
                  <div>
                    <div className="h-20 rounded-lg border-2 border-border" />
                    <p className="mt-2 font-medium text-sm">Border</p>
                    <p className="text-xs text-muted-foreground">border-border</p>
                  </div>
                </div>
              </Section>

              <Separator />

              <Section title="Foreground Colors" description="Text and icon colors for proper contrast.">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-4 rounded-lg border">
                    <p className="text-foreground font-medium">Foreground</p>
                    <p className="text-xs text-muted-foreground">text-foreground</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-muted-foreground">Muted Foreground</p>
                    <p className="text-xs text-muted-foreground">text-muted-foreground</p>
                  </div>
                  <div className="p-4 rounded-lg bg-primary">
                    <p className="text-primary-foreground font-medium">Primary FG</p>
                    <p className="text-xs text-primary-foreground/80">text-primary-foreground</p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive">
                    <p className="text-destructive-foreground font-medium">Destructive FG</p>
                    <p className="text-xs text-destructive-foreground/80">text-destructive-foreground</p>
                  </div>
                </div>
              </Section>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-12">
              <Section title="Font Families" description="Typography system using Cormorant Garamond for headings and Montserrat for body text.">
                <div className="grid md:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-serif">Cormorant Garamond</CardTitle>
                      <CardDescription>Serif - Headings & Display</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="font-serif text-4xl mb-4">Aa Bb Cc Dd Ee</p>
                      <p className="font-serif text-xl">The quick brown fox jumps over the lazy dog.</p>
                    </CardContent>
                    <CardFooter>
                      <CodeBlock code='className="font-serif"' />
                    </CardFooter>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-sans">Montserrat</CardTitle>
                      <CardDescription>Sans-serif - Body & UI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="font-sans text-4xl mb-4">Aa Bb Cc Dd Ee</p>
                      <p className="font-sans text-xl">The quick brown fox jumps over the lazy dog.</p>
                    </CardContent>
                    <CardFooter>
                      <CodeBlock code='className="font-sans"' />
                    </CardFooter>
                  </Card>
                </div>
              </Section>

              <Separator />

              <Section title="Typography Scale" description="Predefined heading and text styles.">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h1 className="heading-display">Display Heading</h1>
                    <CodeBlock code='<h1 className="heading-display">Display Heading</h1>' />
                  </div>
                  <div className="space-y-4">
                    <h2 className="heading-section">Section Heading</h2>
                    <CodeBlock code='<h2 className="heading-section">Section Heading</h2>' />
                  </div>
                  <div className="space-y-4">
                    <p className="text-elegant">Elegant body text for refined content presentation.</p>
                    <CodeBlock code='<p className="text-elegant">Elegant body text...</p>' />
                  </div>
                </div>
              </Section>

              <Separator />

              <Section title="Text Sizes" description="Standard Tailwind text size utilities.">
                <div className="space-y-3">
                  <p className="text-xs">text-xs - Extra small text</p>
                  <p className="text-sm">text-sm - Small text</p>
                  <p className="text-base">text-base - Base text (16px)</p>
                  <p className="text-lg">text-lg - Large text</p>
                  <p className="text-xl">text-xl - Extra large text</p>
                  <p className="text-2xl">text-2xl - 2X large text</p>
                  <p className="text-3xl">text-3xl - 3X large text</p>
                  <p className="text-4xl">text-4xl - 4X large text</p>
                </div>
              </Section>
            </TabsContent>

            {/* Buttons Tab */}
            <TabsContent value="buttons" className="space-y-12">
              <Section title="Button Variants" description="All available button styles for different contexts.">
                <div className="grid md:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Primary Variants</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-4">
                        <Button>Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                      </div>
                      <CodeBlock code={`<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>`} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Special Variants</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-4">
                        <Button variant="gold">Gold</Button>
                        <Button variant="destructive">Destructive</Button>
                      </div>
                      <CodeBlock code={`<Button variant="gold">Gold</Button>
<Button variant="destructive">Destructive</Button>`} />
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle>Hero Variants</CardTitle>
                      <CardDescription>Glass-effect buttons for hero sections</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-gradient-dark p-8 rounded-lg flex flex-wrap gap-4">
                        <Button variant="hero">Hero Button</Button>
                        <Button variant="hero-outline">Hero Outline</Button>
                      </div>
                      <CodeBlock code={`<Button variant="hero">Hero Button</Button>
<Button variant="hero-outline">Hero Outline</Button>`} />
                    </CardContent>
                  </Card>
                </div>
              </Section>

              <Separator />

              <Section title="Button Sizes" description="Size variants for different UI contexts.">
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Check className="h-4 w-4" /></Button>
                </div>
                <CodeBlock code={`<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Check /></Button>`} />
              </Section>

              <Separator />

              <Section title="Button States" description="Interactive states and disabled buttons.">
                <div className="flex flex-wrap gap-4">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button className="pointer-events-none opacity-50">Loading...</Button>
                </div>
              </Section>
            </TabsContent>

            {/* Cards Tab */}
            <TabsContent value="cards" className="space-y-12">
              <Section title="Standard Card" description="Basic card component with header, content, and footer.">
                <div className="grid md:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Card Title</CardTitle>
                      <CardDescription>Card description goes here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p>Card content with any components or text you need.</p>
                    </CardContent>
                    <CardFooter>
                      <Button>Action</Button>
                    </CardFooter>
                  </Card>
                  <CodeBlock code={`<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>`} />
                </div>
              </Section>

              <Separator />

              <Section title="Luxury Card" description="Premium card style with hover effects for featured content.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="card-luxury p-6 rounded-lg">
                    <h3 className="font-serif text-xl mb-2">Luxury Card</h3>
                    <p className="text-muted-foreground">
                      This card has special hover effects and styling for premium content.
                    </p>
                    <Button variant="gold" className="mt-4">Learn More</Button>
                  </div>
                  <CodeBlock code={`<div className="card-luxury p-6 rounded-lg">
  <h3 className="font-serif text-xl">Title</h3>
  <p>Content</p>
  <Button variant="gold">Learn More</Button>
</div>`} />
                </div>
              </Section>
            </TabsContent>

            {/* Forms Tab */}
            <TabsContent value="forms" className="space-y-12">
              <Section title="Input Fields" description="Text input components for forms.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text">Text Input</Label>
                      <Input id="text" placeholder="Enter text..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Input</Label>
                      <Input id="email" type="email" placeholder="email@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disabled">Disabled Input</Label>
                      <Input id="disabled" disabled placeholder="Disabled..." />
                    </div>
                  </div>
                  <CodeBlock code={`<div className="space-y-2">
  <Label htmlFor="text">Text Input</Label>
  <Input id="text" placeholder="Enter text..." />
</div>`} />
                </div>
              </Section>

              <Separator />

              <Section title="Textarea" description="Multi-line text input.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label htmlFor="textarea">Message</Label>
                    <Textarea id="textarea" placeholder="Type your message here..." />
                  </div>
                  <CodeBlock code={`<div className="space-y-2">
  <Label htmlFor="textarea">Message</Label>
  <Textarea placeholder="Type..." />
</div>`} />
                </div>
              </Section>

              <Separator />

              <Section title="Selection Controls" description="Checkboxes, radio buttons, switches, and selects.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="terms" />
                      <Label htmlFor="terms">Accept terms and conditions</Label>
                    </div>

                    <RadioGroup defaultValue="option-1">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="option-1" id="option-1" />
                        <Label htmlFor="option-1">Option 1</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="option-2" id="option-2" />
                        <Label htmlFor="option-2">Option 2</Label>
                      </div>
                    </RadioGroup>

                    <div className="flex items-center space-x-2">
                      <Switch id="switch" />
                      <Label htmlFor="switch">Enable notifications</Label>
                    </div>

                    <div className="space-y-2">
                      <Label>Select Option</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Option 1</SelectItem>
                          <SelectItem value="2">Option 2</SelectItem>
                          <SelectItem value="3">Option 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <CodeBlock code={`{/* Checkbox */}
<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms</Label>
</div>

{/* Radio Group */}
<RadioGroup defaultValue="option-1">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option-1" id="opt1" />
    <Label htmlFor="opt1">Option 1</Label>
  </div>
</RadioGroup>

{/* Switch */}
<div className="flex items-center space-x-2">
  <Switch id="switch" />
  <Label htmlFor="switch">Enable</Label>
</div>

{/* Select */}
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
  </SelectContent>
</Select>`} />
                </div>
              </Section>

              <Separator />

              <Section title="Slider" description="Range input for numeric values.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label>Value: {sliderValue[0]}</Label>
                    <Slider
                      value={sliderValue}
                      onValueChange={setSliderValue}
                      max={100}
                      step={1}
                    />
                  </div>
                  <CodeBlock code={`<Slider
  value={sliderValue}
  onValueChange={setSliderValue}
  max={100}
  step={1}
/>`} />
                </div>
              </Section>
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback" className="space-y-12">
              <Section title="Alerts" description="Contextual feedback messages.">
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                      This is an informational alert message.
                    </AlertDescription>
                  </Alert>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      This is a destructive alert for errors.
                    </AlertDescription>
                  </Alert>
                </div>
                <CodeBlock code={`<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>Message here</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Error message</AlertDescription>
</Alert>`} />
              </Section>

              <Separator />

              <Section title="Badges" description="Small status indicators and labels.">
                <div className="flex flex-wrap gap-4 mb-4">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
                <CodeBlock code={`<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>`} />
              </Section>

              <Separator />

              <Section title="Toast Notifications" description="Brief messages that appear temporarily.">
                <div className="flex flex-wrap gap-4 mb-4">
                  <Button onClick={() => toast.success("Success! Operation completed.")}>
                    Success Toast
                  </Button>
                  <Button onClick={() => toast.error("Error! Something went wrong.")}>
                    Error Toast
                  </Button>
                  <Button onClick={() => toast.info("Info: Here's some information.")}>
                    Info Toast
                  </Button>
                </div>
                <CodeBlock code={`import { toast } from "sonner";

toast.success("Success message");
toast.error("Error message");
toast.info("Info message");`} />
              </Section>

              <Separator />

              <Section title="Progress" description="Visual indicator of task completion.">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  <div className="flex gap-4">
                    <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>-10%</Button>
                    <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>+10%</Button>
                  </div>
                </div>
                <CodeBlock code={`<Progress value={66} />`} />
              </Section>
            </TabsContent>

            {/* Effects Tab */}
            <TabsContent value="effects" className="space-y-12">
              <Section title="Shadows" description="Box shadow utilities for depth and elevation.">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="h-24 bg-card rounded-lg shadow-soft flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">shadow-soft</span>
                  </div>
                  <div className="h-24 bg-card rounded-lg shadow-card flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">shadow-card</span>
                  </div>
                  <div className="h-24 bg-card rounded-lg shadow-gold flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">shadow-gold</span>
                  </div>
                  <div className="h-24 bg-card rounded-lg shadow-lg flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">shadow-lg</span>
                  </div>
                </div>
              </Section>

              <Separator />

              <Section title="Gradients" description="Background gradient utilities.">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-32 rounded-lg bg-gradient-gold flex items-center justify-center">
                    <span className="text-charcoal font-medium">bg-gradient-gold</span>
                  </div>
                  <div className="h-32 rounded-lg bg-gradient-dark flex items-center justify-center">
                    <span className="text-cream font-medium">bg-gradient-dark</span>
                  </div>
                  <div className="h-32 rounded-lg bg-gradient-cream flex items-center justify-center border">
                    <span className="text-charcoal font-medium">bg-gradient-cream</span>
                  </div>
                  <div className="h-32 rounded-lg bg-gradient-hero flex items-center justify-center">
                    <span className="text-cream font-medium">bg-gradient-hero</span>
                  </div>
                </div>
              </Section>

              <Separator />

              <Section title="Gold Underline" description="Decorative underline effect for links and headings.">
                <div className="space-y-4">
                  <h3 className="text-2xl font-serif gold-underline inline-block">Hover for Effect</h3>
                  <CodeBlock code={`<span className="gold-underline">Hover for Effect</span>`} />
                </div>
              </Section>

              <Separator />

              <Section title="Border Radius" description="Rounded corner utilities.">
                <div className="flex flex-wrap gap-6">
                  <div className="h-16 w-16 bg-primary rounded-sm flex items-center justify-center text-primary-foreground text-xs">sm</div>
                  <div className="h-16 w-16 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-xs">md</div>
                  <div className="h-16 w-16 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs">lg</div>
                  <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center text-primary-foreground text-xs">xl</div>
                  <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs">full</div>
                </div>
              </Section>
            </TabsContent>

            {/* Animations Tab */}
            <TabsContent value="animations" className="space-y-12">
              <Section title="Fade Animations" description="Smooth fade transitions for elements.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="animate-fade-up bg-card p-6 rounded-lg border">
                      <p className="font-medium">Fade Up Animation</p>
                      <p className="text-sm text-muted-foreground">animate-fade-up</p>
                    </div>
                    <div className="animate-fade-in bg-card p-6 rounded-lg border">
                      <p className="font-medium">Fade In Animation</p>
                      <p className="text-sm text-muted-foreground">animate-fade-in</p>
                    </div>
                  </div>
                  <CodeBlock code={`<div className="animate-fade-up">
  Fades up into view
</div>

<div className="animate-fade-in">
  Fades into view
</div>`} />
                </div>
              </Section>

              <Separator />

              <Section title="Stagger Animations" description="Sequential delays for list items.">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`animate-fade-up stagger-${i} bg-card p-4 rounded-lg border`}
                      >
                        <p className="text-sm">Item {i} with stagger-{i}</p>
                      </div>
                    ))}
                  </div>
                  <CodeBlock code={`{items.map((item, i) => (
  <div 
    key={i} 
    className={\`animate-fade-up stagger-\${i + 1}\`}
  >
    {item}
  </div>
))}`} />
                </div>
              </Section>

              <Separator />

              <Section title="Hover Effects" description="Interactive hover animations.">
                <div className="flex flex-wrap gap-6">
                  <div className="hover-scale bg-card p-6 rounded-lg border cursor-pointer">
                    <p className="font-medium">Hover Scale</p>
                    <p className="text-sm text-muted-foreground">hover-scale class</p>
                  </div>
                  <div className="transition-transform hover:scale-105 hover:shadow-lg bg-card p-6 rounded-lg border cursor-pointer">
                    <p className="font-medium">Custom Hover</p>
                    <p className="text-sm text-muted-foreground">Tailwind transitions</p>
                  </div>
                </div>
              </Section>

              <Separator />

              <Section title="Slide Animation" description="Slide-in effect for sidebars and panels.">
                <CodeBlock code={`// Slide in from right
className="animate-slide-in"

// Custom keyframe in tailwind.config.ts
keyframes: {
  "slide-in": {
    "0%": { transform: "translateX(100%)" },
    "100%": { transform: "translateX(0)" }
  }
}`} />
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
