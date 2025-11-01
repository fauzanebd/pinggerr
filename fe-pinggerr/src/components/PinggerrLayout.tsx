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
import type { StravaActivity } from "@/types/strava";
import stravaLogo from "@/assets/api_logo_pwrdBy_strava_horiz_orange.png";

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
          <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
            <img
              src={stravaLogo}
              alt="Powered by Strava"
              className="h-4 w-auto ml-2"
            />
            <span className="text-brand-pink">|</span>
            <span>
              {language === "en" ? "developed by" : "dikembangkan oleh"}
            </span>
            <a
              href="https://instagram.com/fauzanebd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-green hover:text-brand-pink font-medium transition-colors"
            >
              fauzanebd
            </a>
            <span className="text-brand-pink">|</span>
            <a
              href="https://github.com/fauzanebd/pinggerr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-green hover:text-brand-pink font-medium transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={18}
                height={18}
                fill="currentColor"
                viewBox="0 0 24 24"
                className="inline-block"
                aria-hidden="true"
              >
                <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.606-2.665-.304-5.466-1.334-5.466-5.931 0-1.31.468-2.381 1.235-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.873.119 3.176.77.84 1.234 1.911 1.234 3.221 0 4.609-2.804 5.625-5.475 5.921.43.372.813 1.104.813 2.226 0 1.606-.015 2.898-.015 3.293 0 .321.218.694.825.576C20.565 21.796 24 17.299 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              github
            </a>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
