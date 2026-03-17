'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ChevronDown, Menu, X, Store, Calendar, Users, Sparkles, LayoutGrid, BarChart3, FileText, User, Bot, Zap, Shield, Clock, Headphones, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedGroup } from '@/components/ui/animated-group';
import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import Footer from '@/components/layout/footer';
import { cn } from '@/lib/utils';
import type { Variants } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';

const transitionVariants = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring' as const,
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
} satisfies { item: Variants };

const trustedLogos = [
    { src: "/logos/aws.svg", alt: "AWS" },
    { src: "/logos/google-cloud.svg", alt: "Google Cloud" },
    { src: "/logos/tiktok.svg", alt: "TikTok" },
    { src: "/logos/soundcloud-wordmark.svg", alt: "SoundCloud" },
    { src: "/logos/perplexity_wordmark_dark.svg", alt: "Perplexity AI" },
    { src: "/logos/tL_v571NdZ0.svg", alt: "Meta" },
    { src: "/logos/facebook-wordmark.svg", alt: "Facebook" },
    { src: "/logos/whatsapp-wordmark.svg", alt: "WhatsApp" },
    { src: "/logos/instagram-wordmark.svg", alt: "Instagram" },
    { src: "/logos/google-wordmark.svg", alt: "Google" },
    { src: "/logos/openai_wordmark_dark.svg", alt: "OpenAI" },
    { src: "/logos/gemini_wordmark.svg", alt: "Gemini" },
    { src: "/logos/LI-Logo.png", alt: "linkedin" },
];

export function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden bg-white" dir="rtl">
                <div
                    aria-hidden
                    className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 contain-strict hidden lg:block">
                    <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute right-0 top-0 rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(var(--primary)/0.08)_0,hsla(var(--primary)/0.02)_50%,hsla(var(--primary)/0)_80%)]" />
                    <div className="h-[80rem] absolute right-0 top-0 w-56 rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(var(--primary)/0.06)_0,hsla(var(--primary)/0.02)_80%,transparent_100%)] [translate:-5%_-50%]" />
                    <div className="h-[80rem] -translate-y-[350px] absolute right-0 top-0 w-56 rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(var(--primary)/0.04)_0,hsla(var(--primary)/0.02)_80%,transparent_100%)]" />
                </div>
                <section>
                    <div className="relative pt-20 sm:pt-24 md:pt-36">
                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            delayChildren: 1,
                                        },
                                    },
                                },
                                item: {
                                    hidden: {
                                        opacity: 0,
                                        y: 20,
                                    },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: {
                                            type: 'spring' as const,
                                            bounce: 0.3,
                                            duration: 2,
                                        },
                                    },
                                },
                            }}
                            className="absolute inset-0 -z-20">
                            <Image
                                src="https://images.unsplash.com/photo-1557683316-973673baf926?w=3276&q=80"
                                alt="خلفية"
                                className="absolute inset-x-0 top-56 -z-20 hidden lg:top-32 dark:block object-cover"
                                width={3276}
                                height={4095}
                                priority
                            />
                        </AnimatedGroup>
                        <div aria-hidden className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]" />
                        <div className="mx-auto max-w-7xl px-4 sm:px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                                <AnimatedGroup variants={transitionVariants as { item: Variants }}>
                                    <Link
                                        href="/features"
                                        className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-2 sm:gap-4 rounded-full border p-1 pr-3 sm:pr-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950">
                                        <span className="text-foreground text-xs sm:text-sm">🎉 اكتشف مميزات ركني الجديدة</span>
                                        <span className="dark:border-background block h-4 w-0.5 border-r bg-white dark:bg-zinc-700 hidden sm:block"></span>

                                        <div className="bg-background group-hover:bg-muted size-5 sm:size-6 overflow-hidden rounded-full duration-500">
                                            <div className="flex w-10 sm:w-12 translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                                                <span className="flex size-5 sm:size-6">
                                                    <ArrowRight className="m-auto size-2.5 sm:size-3 rotate-180" />
                                                </span>
                                                <span className="flex size-5 sm:size-6">
                                                    <ArrowRight className="m-auto size-2.5 sm:size-3 rotate-180" />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>

                                    <h1
                                        className="mt-6 sm:mt-8 max-w-4xl mx-auto text-balance text-3xl sm:text-4xl md:text-5xl font-bold lg:text-6xl lg:mt-16 xl:text-[4.5rem] leading-tight">
                                        أنشئ صفحتك الاحترافية مع منصة <span className="text-primary">ركني</span>
                                    </h1>
                                    <p
                                        className="mx-auto mt-4 sm:mt-6 md:mt-8 max-w-2xl text-balance text-sm sm:text-base md:text-lg text-muted-foreground px-2">
                                        صفحة واحدة تجمع روابطك ومنتجاتك ونماذجك. كل ما تحتاجه للتواصل مع جمهورك وتنمية أعمالك.
                                    </p>
                                </AnimatedGroup>

                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.05,
                                                    delayChildren: 0.75,
                                                },
                                            },
                                        },
                                        item: transitionVariants.item,
                                    }}
                                    className="mt-8 sm:mt-10 md:mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
                                    <div
                                        key={1}
                                        className="bg-foreground/10 rounded-[14px] border p-0.5">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="rounded-xl px-6 sm:px-8 text-sm sm:text-base h-11 sm:h-12">
                                            <Link href="/app">
                                                <span className="text-nowrap">ابدأ مجاناً</span>
                                            </Link>
                                        </Button>
                                    </div>
                                </AnimatedGroup>
                            </div>
                        </div>

                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            staggerChildren: 0.05,
                                            delayChildren: 0.75,
                                        },
                                    },
                                },
                                item: transitionVariants.item,
                            }}>
                            <div className="relative mt-8 sm:mt-12 md:mt-20 overflow-hidden px-4 sm:px-6">
                                <div
                                    aria-hidden
                                    className="bg-gradient-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                                />
                                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-xl sm:rounded-2xl border p-2 sm:p-4 shadow-lg shadow-zinc-950/15 ring-1">
                                    <Image
                                        className="bg-background aspect-[16/10] sm:aspect-[15/8] relative hidden rounded-xl sm:rounded-2xl dark:block object-cover"
                                        src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=2700&q=80"
                                        alt="لوحة تحكم ركني"
                                        width={2700}
                                        height={1440}
                                    />
                                    <Image
                                        className="z-2 border-border/25 aspect-[16/10] sm:aspect-[15/8] relative rounded-xl sm:rounded-2xl border dark:hidden object-cover"
                                        src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=2700&q=80"
                                        alt="لوحة تحكم ركني"
                                        width={2700}
                                        height={1440}
                                    />
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>

                {/* Trusted Companies Section - LogoCloud */}
                <section className="relative w-full px-4 py-10 sm:py-16 md:py-20 -mt-16 sm:-mt-10 md:mt-0">
                    {/* Decorative background */}
                    <div className="absolute inset-0 -z-10">
                        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
                        <div
                            aria-hidden="true"
                            className="absolute left-1/2 top-0 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent"
                        />
                        <div
                            aria-hidden="true"
                            className="absolute left-1/2 bottom-0 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent"
                        />
                    </div>
                    
                    <div className="relative z-10 mx-auto w-full max-w-5xl">
                        <div className="text-center mb-6 sm:mb-10">
                            <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs sm:text-sm font-medium text-primary mb-3 sm:mb-4">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                موثوق عالمياً
                            </span>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
                                نستخدم أفضل التقنيات العالمية
                            </h2>
                            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground md:text-lg max-w-2xl mx-auto">
                                نعتمد على أحدث التقنيات من الشركات الرائدة لضمان أفضل تجربة لك
                            </p>
                        </div>
                        <div className="relative" dir="ltr">
                            {/* Edge fade effects */}
                            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24 md:w-32 lg:w-40 bg-gradient-to-r from-background via-background/80 to-transparent" />
                            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24 md:w-32 lg:w-40 bg-gradient-to-l from-background via-background/80 to-transparent" />
                            
                            <InfiniteSlider gap={32} duration={25} durationOnHover={50}>
                                {trustedLogos.map((logo) => (
                                    <div
                                        key={logo.alt}
                                        className="group flex items-center justify-center"
                                    >
                                        <img
                                            src={logo.src}
                                            alt={logo.alt}
                                            className="h-6 w-auto max-w-[100px] sm:h-7 sm:max-w-[120px] md:h-8 md:max-w-[140px] object-contain opacity-50 grayscale transition-all duration-300 ease-out group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-110"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                ))}
                            </InfiniteSlider>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="bg-background py-12 md:py-24">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6">
                        <div className="text-center mb-8 md:mb-16">
                            <h2 className="text-2xl sm:text-3xl font-bold md:text-4xl mb-3 md:mb-4">كل ما تحتاجه في مكان واحد</h2>
                            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
                                أدوات متكاملة لإدارة أعمالك بكفاءة عالية
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                            <FeatureCard
                                icon={<Store className="size-5 sm:size-6" />}
                                title="إنشاء المتاجر"
                                description="أنشئ متجرك الإلكتروني بسهولة وابدأ البيع فوراً"
                            />
                            <FeatureCard
                                icon={<Calendar className="size-5 sm:size-6" />}
                                title="إدارة الفعاليات"
                                description="نظّم فعالياتك واستقبل الحجوزات بشكل آلي"
                            />
                            <FeatureCard
                                icon={<Users className="size-5 sm:size-6" />}
                                title="تواصل مع العملاء"
                                description="تابع عملاءك وأرسل لهم التحديثات والعروض"
                            />
                            <FeatureCard
                                icon={<Sparkles className="size-5 sm:size-6" />}
                                title="تحليلات متقدمة"
                                description="راقب أداء متجرك واتخذ قرارات ذكية"
                            />
                        </div>
                    </div>
                </section>

                {/* Advantages Section */}
                <section className="bg-muted/10 py-10 sm:py-12 md:py-20 lg:py-28 m-2 md:m-12 rounded-3xl sm:rounded-4xl">
                    <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6">
                        <div className="flex gap-4 flex-col items-start sm:items-center sm:text-center">
                            <Badge variant="secondary" className="text-xs sm:text-sm">
                                لماذا ركني؟
                            </Badge>
                            <div className="flex gap-2 sm:gap-3 flex-col">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight font-bold">
                                    مميزات تجعلنا الخيار الأول
                                </h2>
                                <p className="text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed text-muted-foreground">
                                    نقدم لك أدوات متكاملة تساعدك على إدارة أعمالك بكفاءة وسهولة، مع دعم فني متواصل.
                                </p>
                            </div>
                            <div className="flex gap-6 sm:gap-8 md:gap-10 pt-8 sm:pt-10 md:pt-12 flex-col w-full">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                                    <AdvantageItem 
                                        icon={<Zap className="size-4 sm:size-5 text-primary" />}
                                        title="سرعة فائقة"
                                        description="أداء سريع وموثوق يضمن تجربة سلسة لك ولعملائك."
                                    />
                                    <AdvantageItem 
                                        icon={<Shield className="size-4 sm:size-5 text-primary" />}
                                        title="أمان متقدم"
                                        description="حماية بياناتك وبيانات عملائك بأعلى معايير الأمان."
                                    />
                                    <AdvantageItem 
                                        icon={<Clock className="size-4 sm:size-5 text-primary" />}
                                        title="توفير الوقت"
                                        description="أتمتة المهام المتكررة لتركز على تنمية أعمالك."
                                    />
                                    <AdvantageItem 
                                        icon={<Headphones className="size-4 sm:size-5 text-primary" />}
                                        title="دعم متواصل"
                                        description="فريق دعم جاهز لمساعدتك على مدار الساعة."
                                    />
                                    <AdvantageItem 
                                        icon={<Globe className="size-4 sm:size-5 text-primary" />}
                                        title="وصول عالمي"
                                        description="اعرض منتجاتك وخدماتك للعملاء في كل مكان."
                                    />
                                    <AdvantageItem 
                                        icon={<BarChart3 className="size-4 sm:size-5 text-primary" />}
                                        title="تحليلات ذكية"
                                        description="تقارير مفصلة تساعدك على اتخاذ قرارات أفضل."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <Footer />
            </main>
        </>
    );
}


function AdvantageItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex flex-row gap-3 sm:gap-4 w-full items-start p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-background/60 border border-border/50 hover:border-primary/30 hover:bg-background transition-all duration-300">
            <div className="size-8 sm:size-9 md:size-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="flex flex-col gap-0.5 sm:gap-1 text-right">
                <p className="font-semibold text-sm sm:text-base">{title}</p>
                <p className="text-muted-foreground text-[11px] sm:text-xs md:text-sm leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="group relative rounded-2xl border border-border/50 bg-muted/40 p-4 sm:p-6 transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:bg-muted/60">
            <div className="mb-3 sm:mb-4 inline-flex size-10 sm:size-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                {icon}
            </div>
            <h3 className="mb-1 sm:mb-2 text-sm sm:text-lg font-semibold leading-tight">{title}</h3>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">{description}</p>
        </div>
    );
}

const menuItems = [
    { name: 'الأسعار', href: '/pricing' },
    { name: 'المطورين', href: '/developers' },
    { name: 'التحديثات', href: '/updates' },
];

const productItems = [
    { name: 'المتاجر الإلكترونية', href: '/products/stores', icon: Store, description: 'أنشئ متجرك وابدأ البيع فوراً' },
    { name: 'إدارة الفعاليات', href: '/products/events', icon: Calendar, description: 'نظّم فعالياتك واستقبل الحجوزات' },
    { name: 'النماذج الذكية', href: '/products/forms', icon: FileText, description: 'أنشئ نماذج واستبيانات متقدمة' },
    { name: 'الملف الشخصي', href: '/products/profile', icon: User, description: 'صفحة شخصية احترافية لعملك' },
    { name: 'التحليلات', href: '/products/analytics', icon: BarChart3, description: 'راقب أداء أعمالك بالتفصيل بشكل متقدم' },
    { name: 'الذكاء الاصطناعي', href: '/products/ai', icon: Bot, description: 'أدوات ذكية لتطوير أعمالك' },
];

const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false);
    const [isScrolled, setIsScrolled] = React.useState(false);
    const [productMenuOpen, setProductMenuOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close product menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setProductMenuOpen(false);
            }
        };
        if (productMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [productMenuOpen]);

    return (
        <header dir="rtl" className="relative">
            <nav className="fixed z-50 w-full px-3 sm:px-4 pt-3 sm:pt-4">
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ 
                        y: 0, 
                        opacity: 1,
                    }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                        'mx-auto transition-all duration-500 ease-out border',
                        isScrolled 
                            ? 'max-w-4xl bg-white/80 backdrop-blur-xl shadow-lg shadow-black/5 border-border/30 rounded-2xl' 
                            : 'max-w-7xl bg-white/60 backdrop-blur-md border-border/20 rounded-4xl'
                    )}
                >
                    <div className={cn(
                        'mx-auto transition-all duration-500 ease-out',
                        isScrolled ? 'px-3 sm:px-4' : 'px-4 sm:px-6'
                    )}>
                        <div className={cn(
                            'flex items-center justify-between transition-all duration-500',
                            isScrolled ? 'h-12 sm:h-12' : 'h-14 sm:h-16'
                        )}>
                            {/* Logo */}
                            <Link
                                href="/"
                                aria-label="الصفحة الرئيسية"
                                className="flex items-center gap-2 shrink-0">
                                <RuknyLogo />
                            </Link>

                            {/* Desktop Navigation - Center */}
                            <div className="hidden lg:flex items-center gap-1">
                                {/* Products Dropdown */}
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setProductMenuOpen(!productMenuOpen)}
                                        onMouseEnter={() => setProductMenuOpen(true)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors duration-200',
                                            'text-foreground/80 hover:text-foreground',
                                            productMenuOpen && 'text-foreground'
                                        )}
                                    >
                                        <span>المنتجات</span>
                                        <ChevronDown className={cn(
                                            'size-4 transition-transform duration-300',
                                            productMenuOpen && 'rotate-180'
                                        )} />
                                    </button>
                                </div>

                                {/* Other Menu Items */}
                                {menuItems.map((item) => (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                            </div>

                            {/* Desktop CTA Buttons */}
                            <div className="hidden lg:flex items-center gap-4 shrink-0">
                                <Button
                                    asChild
                                    size="sm"
                                    className="rounded-lg px-5 h-9"
                                >
                                    <Link href="/app">
                                        <LayoutGrid className="size-4 ml-2" />
                                        لوحة التحكم
                                    </Link>
                                </Button>
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? 'إغلاق القائمة' : 'فتح القائمة'}
                                className="flex lg:hidden items-center justify-center size-9 sm:size-10 rounded-lg hover:bg-muted/80 active:bg-muted transition-colors"
                            >
                                <AnimatePresence mode="wait">
                                    {menuState ? (
                                        <motion.div
                                            key="close"
                                            initial={{ rotate: -90, opacity: 0 }}
                                            animate={{ rotate: 0, opacity: 1 }}
                                            exit={{ rotate: 90, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <X className="size-5" />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="menu"
                                            initial={{ rotate: 90, opacity: 0 }}
                                            animate={{ rotate: 0, opacity: 1 }}
                                            exit={{ rotate: -90, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <Menu className="size-5" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Mega Menu Dropdown - Full Width like wayl.io */}
                <AnimatePresence>
                    {productMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className={cn(
                                "fixed inset-x-0 z-40 hidden lg:block px-4",
                                isScrolled ? "top-[4.5rem]" : "top-[5.25rem]"
                            )}
                            onMouseEnter={() => setProductMenuOpen(true)}
                            onMouseLeave={() => setProductMenuOpen(false)}
                        >
                            <div className={cn(
                                "mx-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl shadow-black/5 transition-all duration-300",
                                isScrolled ? "max-w-4xl rounded-2xl" : "max-w-7xl rounded-xl"
                            )}>
                                <div className="px-6 py-8">
                                    <div className="grid grid-cols-12 gap-8">
                                        {/* Products Grid - 3 columns for 6 items */}
                                        <div className="col-span-9">
                                            <div className="grid grid-cols-3 gap-3">
                                                {productItems.map((item, index) => (
                                                    <motion.div
                                                        key={item.name}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.03 }}
                                                    >
                                                        <Link
                                                            href={item.href}
                                                            className="flex items-start gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors group"
                                                            onClick={() => setProductMenuOpen(false)}
                                                        >
                                                            <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                                                                <item.icon className="size-5 text-primary" />
                                                            </div>
                                                            <div className="text-right min-w-0">
                                                                <span className="block text-sm font-semibold text-foreground mb-0.5">{item.name}</span>
                                                                <span className="block text-xs text-muted-foreground leading-relaxed">{item.description}</span>
                                                            </div>
                                                        </Link>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* CTA Card */}
                                        <div className="col-span-3">
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.15 }}
                                                className="bg-muted/50 rounded-2xl p-6 h-full flex flex-col justify-between"
                                            >
                                                <div>
                                                    <h3 className="text-xl font-bold mb-2">مشروع خاص<br />أو مؤسسة؟</h3>
                                                    <p className="text-muted-foreground text-sm">
                                                        تواصل معنا للحصول على حلول مخصصة لاحتياجات عملك
                                                    </p>
                                                </div>
                                                <Link
                                                    href="/contact"
                                                    className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors mt-4 group"
                                                    onClick={() => setProductMenuOpen(false)}
                                                >
                                                    <ArrowRight className="size-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                                    <span>احجز استشارة الآن</span>
                                                </Link>
                                            </motion.div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Menu - Top Sheet */}
                <AnimatePresence>
                    {menuState && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                                onClick={() => setMenuState(false)}
                            />
                            
                            {/* Top Sheet */}
                            <motion.div
                                initial={{ y: '-100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '-100%' }}
                                transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                                drag="y"
                                dragConstraints={{ top: 0, bottom: 0 }}
                                dragElastic={{ top: 0, bottom: 0.4 }}
                                dragMomentum={true}
                                dragTransition={{ bounceStiffness: 200, bounceDamping: 30 }}
                                onDragEnd={(_, info) => {
                                    // Close if dragged down more than 100px or with fast velocity
                                    if (info.offset.y > 100 || info.velocity.y > 200) {
                                        setMenuState(false);
                                    }
                                }}
                                whileDrag={{ cursor: 'grabbing' }}
                                className="fixed top-0 left-0 right-0 bg-white rounded-b-3xl shadow-2xl z-50 lg:hidden max-h-[90vh] overflow-hidden touch-pan-y"
                                style={{ touchAction: 'pan-y' }}
                            >
                                <div className="overflow-y-auto max-h-[90vh] px-5 pt-5 pb-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <RuknyLogo />
                                        <button
                                            onClick={() => setMenuState(false)}
                                            className="size-9 rounded-full bg-muted hover:bg-muted/80 active:scale-95 flex items-center justify-center transition-all"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>

                                    {/* Products Section - Cards with Text */}
                                    <div className="mb-5">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">المنتجات</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {productItems.map((item, index) => (
                                                <motion.div
                                                    key={item.name}
                                                    initial={{ opacity: 0, y: -20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 + 0.1 }}
                                                >
                                                    <Link
                                                        href={item.href}
                                                        className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted active:scale-[0.98] transition-all border border-border/50"
                                                        onClick={() => setMenuState(false)}
                                                    >
                                                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                            <item.icon className="size-5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-right">
                                                            <span className="block text-sm font-semibold leading-tight">{item.name}</span>
                                                            <span className="block text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{item.description}</span>
                                                        </div>
                                                    </Link>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quick Links */}
                                    <div className="flex gap-2 mb-5">
                                        {menuItems.map((item, index) => (
                                            <motion.div
                                                key={item.name}
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 + 0.4 }}
                                                className="flex-1"
                                            >
                                                <Link
                                                    href={item.href}
                                                    className="flex items-center justify-center p-3 rounded-xl bg-muted/50 hover:bg-muted active:scale-[0.98] transition-all"
                                                    onClick={() => setMenuState(false)}
                                                >
                                                    <span className="text-sm font-medium">{item.name}</span>
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Consultation CTA Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                        className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 mb-5 border border-primary/10"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="size-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                                                <Sparkles className="size-5 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-base mb-1">مشروع خاص أو مؤسسة؟</h4>
                                                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                                    تواصل معنا للحصول على حلول مخصصة لاحتياجات عملك
                                                </p>
                                                <Link
                                                    href="/contact"
                                                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                                                    onClick={() => setMenuState(false)}
                                                >
                                                    <ArrowRight className="size-4 rotate-180" />
                                                    <span>احجز استشارة مجانية</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* CTA Buttons */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.55 }}
                                        className="grid grid-cols-2 gap-3 mb-4"
                                    >
                                        <Button asChild variant="outline" className="w-full rounded-xl h-12 text-sm">
                                            <Link href="/auth/login" onClick={() => setMenuState(false)}>
                                                تسجيل الدخول
                                            </Link>
                                        </Button>
                                        <Button asChild className="w-full rounded-xl h-12 text-sm">
                                            <Link href="/app" onClick={() => setMenuState(false)}>
                                                <LayoutGrid className="size-4 ml-2" />
                                                لوحة التحكم
                                            </Link>
                                        </Button>
                                    </motion.div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
};

const RuknyLogo = ({ className }: { className?: string }) => {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-courgette), cursive' }}>Rukny</span>
        </div>
    );
};

export default HeroSection;
