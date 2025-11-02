import * as React from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PinggerrSidebar } from "./PinggerrSidebar";
import { Footer } from "./Footer";
import type { StravaActivity } from "@/types/strava";

interface PinggerrLayoutProps {
  children: React.ReactNode;
  activity: StravaActivity;
  language: "en" | "id";
  isAuthenticated: boolean;
  onBackToList: () => void;
  onLanguageChange: (lang: "en" | "id") => void;
  currentVisualizationType?: string;
  onLogoClick: () => void;
}

export function PinggerrLayout({
  children,
  activity,
  language,
  isAuthenticated,
  onBackToList,
  onLanguageChange,
  currentVisualizationType = "PinkGreen Activity",
  onLogoClick,
}: PinggerrLayoutProps) {
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
  const formatElevation = (meters: number) => `${meters.toFixed(2)} m`;
  return (
    <SidebarProvider>
      <PinggerrSidebar language={language} onLogoClick={onLogoClick} />
      <SidebarInset>
        {/* Header with breadcrumb and language toggle */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  onClick={onBackToList}
                  className="cursor-pointer hover:text-foreground"
                >
                  {language === "en" ? "Activities" : "Aktivitas"}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {language === "en" ? "Visualization" : "Visualisasi"}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentVisualizationType}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Language toggle - positioned on the far right */}
          <div className="ml-auto">
            <Button
              onClick={() => onLanguageChange(language === "en" ? "id" : "en")}
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {language === "en" ? "🇺🇸 EN" : "🇮🇩 ID"}
            </Button>
          </div>
        </header>

        {/* Activity info bar */}
        <div className="p-4 border-b bg-muted/30">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-brand-pink">🏃‍♂️</span>
                  <span className="truncate">{activity.name}</span>
                  {/* <Badge className="bg-brand-green text-white text-xs">
                    {isAuthenticated ? "Strava" : "TCX"}
                  </Badge> */}
                  {activity.id && isAuthenticated && (
                    <Button
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://www.strava.com/activities/${activity.id}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="text-xs hover:text-white font-medium bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {language === "en" ? "View on Strava" : "Lihat di Strava"}
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>📏 {formatDistance(activity.distance)}</span>
                <span>⏱️ {Math.floor(activity.moving_time / 60)} min</span>
                <span>📈 {formatElevation(activity.total_elevation_gain)}</span>
                {activity.type && <span>🏃 {activity.type}</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
          <Footer language={language} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
