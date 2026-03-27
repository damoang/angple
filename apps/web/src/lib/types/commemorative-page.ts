export interface CommemorativePageImage {
    url: string;
    alt: string;
}

export interface CommemorativePageContent {
    eyebrow: string;
    title: string;
    description: string;
    heroParagraphs: string[];
    heroImage: CommemorativePageImage;
    noticeParagraphs?: string[];
    closingParagraphs?: string[];
    closingSignoff?: string;
    closingImage?: CommemorativePageImage;
}
