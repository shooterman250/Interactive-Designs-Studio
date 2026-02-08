
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  overallStyleOptions as baseOverallStyleOptions,
  keyElementOptions as baseKeyElementOptions,
  type BaseSelectionItem
} from "@/types";
import ItemSelectionCard from "@/components/design/ItemSelectionCard";
import { useDesignProgress, type SelectedDataItem, DesignStageKey } from "@/contexts/DesignProgressContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter, usePathname } from "next/navigation";
import { baseNavItemsConfig, type BaseNavItemConfig } from "@/config/navigation";
import { ArrowRight, Home } from "lucide-react";

const PAGE_STAGE_KEY: DesignStageKey = "overall-style";

export default function OverallStylePage() {
  const {
    updateStageSelections,
    getStageSelections,
    getUserRoomSelections,
    getClientInfo
  } = useDesignProgress();

  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [hasSavedSinceLastChange, setHasSavedSinceLastChange] = useState(false);
  const [isSaveButtonActive, setIsSaveButtonActive] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const userRoomSelections = getUserRoomSelections();

  const [uploadedStyleImageUri, setUploadedStyleImageUri] = useState<string | null>(null);
  const [uploadedStyleImageName, setUploadedStyleImageName] = useState<string | null>(null);
  const [uploadedKeyElementImageUri, setUploadedKeyElementImageUri] = useState<string | null>(null);
  const [uploadedKeyElementImageName, setUploadedKeyElementImageName] = useState<string | null>(null);

  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const keyElementFileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const existingSelections = getStageSelections(PAGE_STAGE_KEY);
    if (existingSelections.length > 0) {
      const hasFlooringOption = existingSelections.some(item => item.id === 'flooring-tile');
      if (hasFlooringOption) {
        // Since flooring options are now in their own stage, remove them from here
        updateStageSelections(PAGE_STAGE_KEY, getStageSelections(PAGE_STAGE_KEY).length > 1 ? 50 : 0, existingSelections.filter(item => item.id !== 'flooring-tile'));
      }
      setSelectedOptions(new Set(existingSelections.map(item => {
        if (item.id === 'overall-style-upload' && item.imageUrl?.startsWith('data:image')) {
          setUploadedStyleImageUri(item.imageUrl);
          setUploadedStyleImageName(item.name.replace('Custom Style: ', ''));
        }
        if (item.id === 'key-element-upload' && item.imageUrl?.startsWith('data:image')) {
          setUploadedKeyElementImageUri(item.imageUrl);
          setUploadedKeyElementImageName(item.name.replace('Custom Element: ', ''));
        }
        return item.id;
      })));
    }
  }, [getStageSelections, updateStageSelections]);

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'style' | 'keyElement'
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        if (type === 'style') {
          setUploadedStyleImageUri(dataUri);
          setUploadedStyleImageName(file.name);
          setSelectedOptions(prev => new Set(prev).add('overall-style-upload'));
        } else {
          setUploadedKeyElementImageUri(dataUri);
          setUploadedKeyElementImageName(file.name);
          setSelectedOptions(prev => new Set(prev).add('key-element-upload'));
        }
        setHasSavedSinceLastChange(false);
        setIsSaveButtonActive(true);
        // toast({ title: "Image Uploaded", description: `${file.name} is ready to be saved with your choices.` });
      };
      reader.readAsDataURL(file);
    }
    // Reset file input to allow re-uploading the same file if needed
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleOptionChange = (optionId: string) => {
    if (optionId === 'overall-style-upload') {
      styleFileInputRef.current?.click();
      // Selection will be handled by handleImageUpload
      return;
    }
    if (optionId === 'key-element-upload') {
      keyElementFileInputRef.current?.click();
      // Selection will be handled by handleImageUpload
      return;
    }

    setSelectedOptions(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(optionId)) {
        newSelected.delete(optionId);
        if (optionId === 'overall-style-upload') {
          setUploadedStyleImageUri(null);
          setUploadedStyleImageName(null);
        }
        if (optionId === 'key-element-upload') {
          setUploadedKeyElementImageUri(null);
          setUploadedKeyElementImageName(null);
        }
      } else {
        newSelected.add(optionId);
      }
      return newSelected;
    });
    setHasSavedSinceLastChange(false);
    setIsSaveButtonActive(true);
  };

  const pageSpecificDisplayOverallStyleOptions: BaseSelectionItem[] = baseOverallStyleOptions.map(style => {
    let imageUrl = style.imageUrl;
    // Overrides removed to use base options from types/index.ts which now point to local files.

    if (style.id === 'overall-style-upload' && uploadedStyleImageUri) {
      return { ...style, imageUrl: uploadedStyleImageUri, name: `Custom Style: ${uploadedStyleImageName || 'Uploaded'}` };
    }
    return { ...style, imageUrl };
  });

  const pageSpecificDisplayKeyElementOptions: BaseSelectionItem[] = baseKeyElementOptions.map(element => {
    if (element.id === 'key-element-upload' && uploadedKeyElementImageUri) {
      return { ...element, imageUrl: uploadedKeyElementImageUri, name: `Custom Element: ${uploadedKeyElementImageName || 'Uploaded'}` };
    }
    return element;
  });

  const sections: Array<{ title: string; description?: string; options: BaseSelectionItem[]; cols?: number; id: 'design-styles' | 'key-elements' }> = [
    {
      id: 'design-styles',
      title: "Select Design Styles",
      description: "Choose The Style(s) That Represent Your Vision",
      options: pageSpecificDisplayOverallStyleOptions,
      cols: 3
    },
    {
      id: 'key-elements',
      title: "Select Key Elements",
      description: "Add One or More [Optional] Elements",
      options: pageSpecificDisplayKeyElementOptions,
      cols: 3
    },
  ];

  const handleSaveChanges = () => {
    const totalOptionsOnPage = sections.reduce((sum, section) => sum + section.options.length, 0);
    let newProgress = 0;

    const overallStyleOptionIds = new Set(baseOverallStyleOptions.map(opt => opt.id));
    const keyElementOptionIds = new Set(baseKeyElementOptions.map(opt => opt.id));

    let hasSelectedOverallStyle = false;
    let hasSelectedKeyElement = false;

    selectedOptions.forEach(selectedId => {
      if (overallStyleOptionIds.has(selectedId) || selectedId === 'overall-style-upload') {
        hasSelectedOverallStyle = true;
      }
      if (keyElementOptionIds.has(selectedId) || selectedId === 'key-element-upload') {
        hasSelectedKeyElement = true;
      }
    });

    if (selectedOptions.size > 0) {
      if (hasSelectedOverallStyle && (hasSelectedKeyElement || keyElementOptionIds.size === 0 || !keyElementOptionIds.has('key-element-upload'))) {
        newProgress = 100;
      } else if (hasSelectedOverallStyle || hasSelectedKeyElement) {
        const subsectionsCovered = (hasSelectedOverallStyle ? 1 : 0) + (hasSelectedKeyElement ? 1 : 0);
        const totalSubsectionsToConsider = sections.length;
        if (totalSubsectionsToConsider > 0) {
          if (subsectionsCovered === 1 && selectedOptions.size > 0 && totalOptionsOnPage > 0) {
            const itemProgress = Math.round((selectedOptions.size / totalOptionsOnPage) * 50);
            const sectionProgress = 50;
            newProgress = Math.min(itemProgress + sectionProgress, 99);
          } else {
            newProgress = Math.round((subsectionsCovered / totalSubsectionsToConsider) * 100);
          }
          if (subsectionsCovered < totalSubsectionsToConsider && newProgress === 100) newProgress = 99;
        }
      }
    } else {
      newProgress = 0;
    }
    newProgress = Math.max(0, Math.min(100, newProgress));

    const allSelectedItems: SelectedDataItem[] = [];
    selectedOptions.forEach(selectedId => {
      let originalItem: BaseSelectionItem | undefined;
      let displayItem: BaseSelectionItem | undefined;

      displayItem = pageSpecificDisplayOverallStyleOptions.find(item => item.id === selectedId);
      if (displayItem) {
        originalItem = baseOverallStyleOptions.find(item => item.id === selectedId);
        if (!originalItem && selectedId === 'overall-style-upload') { // Handle custom upload explicitly
          originalItem = {
            id: 'overall-style-upload',
            name: `Custom Style: ${uploadedStyleImageName || 'Uploaded'}`,
            imageUrl: uploadedStyleImageUri || '',
            description: 'User uploaded style image.',
            dataAiHint: `custom style ${uploadedStyleImageName || 'image'}`.toLowerCase().split(' ').slice(0, 2).join(' ')
          };
        }
      } else {
        displayItem = pageSpecificDisplayKeyElementOptions.find(item => item.id === selectedId);
        if (displayItem) {
          originalItem = baseKeyElementOptions.find(item => item.id === selectedId);
          if (!originalItem && selectedId === 'key-element-upload') { // Handle custom upload explicitly
            originalItem = {
              id: 'key-element-upload',
              name: `Custom Element: ${uploadedKeyElementImageName || 'Uploaded'}`,
              imageUrl: uploadedKeyElementImageUri || '',
              description: 'User uploaded key element image.',
              dataAiHint: `custom element ${uploadedKeyElementImageName || 'image'}`.toLowerCase().split(' ').slice(0, 2).join(' ')
            };
          }
        }
      }

      if (originalItem) {
        const nameToSave = (selectedId === 'overall-style-upload' && uploadedStyleImageName)
          ? `Custom Style: ${uploadedStyleImageName}`
          : (selectedId === 'key-element-upload' && uploadedKeyElementImageName)
            ? `Custom Element: ${uploadedKeyElementImageName}`
            : originalItem.name;
        const imageUrlToSave = (selectedId === 'overall-style-upload' && uploadedStyleImageUri)
          ? uploadedStyleImageUri
          : (selectedId === 'key-element-upload' && uploadedKeyElementImageUri)
            ? uploadedKeyElementImageUri
            : originalItem.imageUrl;

        allSelectedItems.push({
          id: originalItem.id,
          name: nameToSave,
          imageUrl: imageUrlToSave,
          description: originalItem.description,
          dataAiHint: originalItem.dataAiHint || nameToSave.toLowerCase().replace(/[^a-z0-9\\s]/gi, '').split(' ').slice(0, 2).join(' ')
        });
      }
    });

    updateStageSelections(PAGE_STAGE_KEY, newProgress, allSelectedItems);
    setHasSavedSinceLastChange(true);
    setIsSaveButtonActive(false);

    // toast({
    //   title: "Overall Style Choices Saved",
    //   description: `You've selected ${allSelectedItems.length} item(s). Progress updated to ${newProgress}%.`,
    // });
  };

  const getDynamicNavConfig = (): BaseNavItemConfig[] => {
    const initialStages = baseNavItemsConfig.filter(
      item => item.id === 'overall-budget' || item.id === 'overall-style'
    );

    const orderedInitialStages: BaseNavItemConfig[] = [];
    const budgetStage = initialStages.find(s => s.id === 'overall-budget');
    const styleStage = initialStages.find(s => s.id === 'overall-style');
    if (budgetStage) orderedInitialStages.push(budgetStage);
    if (styleStage) orderedInitialStages.push(styleStage);

    const selectedRoomStages = baseNavItemsConfig.filter(item =>
      userRoomSelections.has(item.id) &&
      item.id !== 'overall-budget' &&
      item.id !== 'overall-style' &&
      item.id !== 'dashboard' &&
      item.id !== 'settings'
    );

    const finalNavOrder: BaseNavItemConfig[] = [...orderedInitialStages];
    baseNavItemsConfig.forEach(baseItem => {
      if (selectedRoomStages.some(srs => srs.id === baseItem.id) && !finalNavOrder.some(fno => fno.id === baseItem.id)) {
        finalNavOrder.push(baseItem);
      }
    });
    return finalNavOrder;
  };

  const dynamicNavConfig = getDynamicNavConfig();
  const currentIndex = dynamicNavConfig.findIndex(item => item.href === pathname);

  let nextStage: BaseNavItemConfig | null = null;
  if (currentIndex !== -1 && currentIndex < dynamicNavConfig.length - 1) {
    nextStage = dynamicNavConfig[currentIndex + 1];
  }

  const handleFinishAndProceed = () => {
    handleSaveChanges();
    const clientInfo = getClientInfo();
    if (!clientInfo || !clientInfo.fullName || !clientInfo.email) {
      toast({
        title: "Client Information Needed",
        description: "Please fill out your client information before viewing the dashboard.",
        variant: "default",
      });
      router.push('/client-info');
    } else {
      router.push('/designer');
    }
  };

  return (
    <div className="min-h-full p-4 md:p-8 bg-background text-foreground">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
          Overall Style &amp; Key Elements
        </h1>
        <p className="mt-2 max-w-2xl mx-auto text-base opacity-80 sm:text-lg">
          Let's start by defining your main design style
        </p>
      </header>

      <section className="max-w-6xl mx-auto space-y-12">
        {sections.map(section => (
          <Card key={section.title} className="bg-card/60 backdrop-blur-lg border border-card-foreground/10 shadow-lg">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {section.description && <CardDescription>{section.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${section.cols || 3} gap-6`}>
                {section.options.map((style) => (
                  <ItemSelectionCard
                    key={style.id}
                    item={style}
                    isSelected={selectedOptions.has(style.id)}
                    onSelect={handleOptionChange}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        <input
          type="file"
          ref={styleFileInputRef}
          onChange={(e) => handleImageUpload(e, 'style')}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={keyElementFileInputRef}
          onChange={(e) => handleImageUpload(e, 'keyElement')}
          accept="image/*"
          className="hidden"
        />

        <div className="pt-4 flex flex-col sm:flex-row justify-end gap-2">
          <Button
            className="w-full sm:w-auto"
            onClick={handleSaveChanges}
            variant={isSaveButtonActive ? "primary" : "default"}
          >
            Save Overall Style Choices ({selectedOptions.size})
          </Button>
          {nextStage ? (
            <Button
              onClick={() => router.push(nextStage.href)}
              variant={hasSavedSinceLastChange ? "primary" : "outline"}
              className="w-full sm:w-auto"
              disabled={!hasSavedSinceLastChange}
            >
              Next Section ({nextStage.label})
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinishAndProceed}
              variant={hasSavedSinceLastChange ? "primary" : "default"}
              className="w-full sm:w-auto"
              disabled={!hasSavedSinceLastChange}
            >
              <Home className="mr-2 h-4 w-4" />
              Finish &amp; Proceed
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

