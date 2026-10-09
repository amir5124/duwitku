import React, { createContext, useContext } from 'react';

type OnboardingContextType = {
    showOnboarding: boolean | null;
    setShowOnboarding: (val: boolean) => void;
};

const OnboardingContext = createContext<OnboardingContextType>({
    showOnboarding: null,
    setShowOnboarding: () => { },
});

export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider = ({
    children,
    value,
}: {
    children: React.ReactNode;
    value: OnboardingContextType;
}) => (
    <OnboardingContext.Provider value={value}>
        {children}
    </OnboardingContext.Provider>
);