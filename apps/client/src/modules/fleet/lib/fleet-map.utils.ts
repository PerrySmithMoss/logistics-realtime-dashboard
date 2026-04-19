import { FleetVehicle } from "../types";

export const buildVehicleSvg = (fill: string): string => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="100" height="130">
    <path d="M50,5 C27.9,5 10,22.9 10,45 C10,75 50,125 50,125 C50,125 90,75 90,45 C90,22.9 72.1,5 50,5 Z"
          fill="${fill}" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="50" cy="45" r="28" fill="#FFFFFF"/>
    <g fill="${fill}">
      <path d="M72,42 L65,34 L45,34 L45,50 L72,50 Z"/>
      <path d="M43,38 L36,38 C32.7,38 30,40.7 30,44 L30,50 L43,50 Z"/>
      <circle cx="38" cy="54" r="5"/>
      <circle cx="62" cy="54" r="5"/>
    </g>
  </svg>
`;

export const loadVehicleIcon = (fill: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildVehicleSvg(fill))}`;
  });

export const buildPopupHtml = (vehicle: Pick<FleetVehicle, "id" | "status">): string => `
  <div class="p-2 font-sans min-w-36 text-black">
    <div class="flex items-center gap-2 mb-1 border-b border-slate-100 pb-1">
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Vehicle</span>
      <h3 class="text-sm font-bold text-slate-800">${vehicle.id}</h3>
    </div>
    <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
      <span class="text-[9px] text-slate-500 uppercase font-medium">Status</span>
      <span class="text-xs font-bold ${vehicle.status === "delayed" ? "text-red-500" : "text-emerald-500"}">
        ${vehicle.status.toUpperCase()}
      </span>
    </div>
  </div>
`;
