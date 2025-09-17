import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Palette } from "lucide-react";
import PinggerrLogo from "@/assets/pinggerr_logo.svg";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

interface PinggerrSidebarProps extends React.ComponentProps<typeof Sidebar> {
  language: "en" | "id";
  onLogoClick: () => void;
}

const visualizationTypes = [
  {
    id: "pinkgreen-activity",
    title: { en: "PinkGreen Activity", id: "Aktivitas PinkGreen" },
    path: "/visualization/pinkgreen-activity",
    icon: Palette,
    description: {
      en: "Classic pink & green visualization",
      id: "Visualisasi klasik pink & hijau",
    },
  },
  // {
  //   id: "3d-stories",
  //   title: { en: "3D Stories", id: "Cerita 3D" },
  //   path: "/visualization/3d-stories",
  //   icon: Layers3,
  //   description: {
  //     en: "Immersive 3D activity stories",
  //     id: "Cerita aktivitas 3D yang imersif",
  //   },
  // },
];

export function PinggerrSidebar({
  language,
  onLogoClick,
  ...props
}: PinggerrSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="cursor-pointer" onClick={onLogoClick}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-secondary text-sidebar-primary-foreground">
                  <img src={PinggerrLogo} alt="Pinggerr" className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-brand-pink">
                    Pinggerr
                  </span>
                  <span className="truncate text-xs">Activity Visualizer</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {language === "en" ? "Visualization Types" : "Jenis Visualisasi"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visualizationTypes.map((type) => (
                <SidebarMenuItem key={type.id}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(type.path)}
                    isActive={location.pathname === type.path}
                    tooltip={type.description[language]}
                  >
                    <type.icon />
                    <span>{type.title[language]}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
