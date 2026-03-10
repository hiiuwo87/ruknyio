"use client";

import {
  ComponentPropsWithoutRef,
  Dispatch,
  ReactNode,
  SetStateAction,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

type SelectOptionProps = {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  isSelected?: boolean;
  setValue?: Dispatch<SetStateAction<string>>;
  handleSelection?: (text: string) => void;
  closeDropdown?: () => void;
};

export function Select({
  children,
  className,
  placeholder,
  setValue,
  value,
  ...props
}: {
  children: ReactNode;
  placeholder: string;
  className?: string;
  setValue: Dispatch<SetStateAction<string>>;
  value?: string;
} & ComponentPropsWithoutRef<"button">) {
  const [isOpened, setIsOpened] = useState<boolean>(false);
  const [displayText, setDisplayText] = useState<string>("");
  const [displayIcon, setDisplayIcon] = useState<ReactNode>(null);
  const [selectedValue, setSelectedValue] = useState<string>(value || "");
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpened(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const closeDropdown = () => setIsOpened(false);

  const handleSelection = (text: string, optionValue: string, icon?: ReactNode) => {
    setDisplayText(text);
    setDisplayIcon(icon);
    setSelectedValue(optionValue);
  };

  const childrenArray = Array.isArray(children) ? children : [children];

  const childrenWithProps = childrenArray.map((child, index) => {
    if (isValidElement<SelectOptionProps>(child)) {
      return cloneElement(child, {
        setValue,
        handleSelection: (text: string) => handleSelection(text, child.props.value, child.props.icon),
        closeDropdown,
        isSelected: selectedValue === child.props.value,
        key: child.props.value || index,
      });
    }
    return child;
  });

  return (
    <div className="relative w-full" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpened(!isOpened)}
        className={cn(
          "h-14 flex items-center gap-2 rounded-full py-3 px-4 bg-background text-foreground border-border border outline-none hover:bg-muted/50 transition ease-in-out duration-200 cursor-pointer w-full justify-between ring-0 focus:ring-2 ring-foreground/10 focus:border-foreground/30 overflow-hidden",
          className
        )}
        {...props}
      >
        <div className="relative overflow-hidden flex-1 h-full flex items-center">
          {displayText ? (
            <div className="flex items-center gap-3">
              {displayIcon && <span className="text-xl">{displayIcon}</span>}
              <span className="text-sm">{displayText}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/70 text-sm">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpened && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpened && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-2 left-0 right-0 border border-border text-foreground rounded-2xl p-1.5 bg-background shadow-lg z-50"
          >
            <div className="grid grid-cols-2 gap-1">
              {childrenWithProps}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SelectOption({
  children,
  value,
  icon,
  isSelected,
  setValue,
  handleSelection,
  closeDropdown,
}: SelectOptionProps) {
  const text = typeof children === 'string' ? children : '';
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer transition-colors duration-150",
        isSelected 
          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" 
          : "hover:bg-muted/50 text-foreground"
      )}
      onClick={() => {
        setValue?.(value);
        handleSelection?.(text);
        closeDropdown?.();
      }}
    >
      <span className="text-sm font-medium">{children}</span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Check className="h-4 w-4" />
        </motion.div>
      )}
    </motion.div>
  );
}
